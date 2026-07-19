/**
 * @fileoverview Global Express Error Handler Middleware
 *
 * Catches all errors thrown or passed via `next(err)` in Express routes.
 * Provides structured JSON error responses, handles Mongoose validation errors
 * specially, and avoids leaking stack traces in production.
 *
 * Usage:
 *   import { globalErrorHandler } from '../middleware/errorHandler';
 *   // MUST be registered AFTER all routes
 *   app.use(globalErrorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { createLogger } from '../config/logger';

const logger = createLogger('error-handler');

/** Structured error response sent to clients. */
interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string>;
  stack?: string;
}

/** Custom application error with optional HTTP status code. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Extracts a user-friendly error map from a Mongoose validation error.
 * Each key is the field name; each value is the validation message.
 */
function formatMongooseValidationError(
  err: MongooseError.ValidationError
): Record<string, string> {
  const details: Record<string, string> = {};
  for (const [field, validationErr] of Object.entries(err.errors)) {
    details[field] = validationErr.message;
  }
  return details;
}

/**
 * Global Express error handler middleware.
 *
 * Must be registered AFTER all route handlers. Express detects this as an
 * error handler because it has four parameters (err, req, res, next).
 */
export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Default to 500 Internal Server Error
  let statusCode = 500;
  let errorType = 'InternalServerError';
  let message = 'An unexpected error occurred';
  let details: Record<string, string> | undefined;

  // --- Handle known error types ---

  // AppError (our custom operational errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorType = statusCode >= 500 ? 'InternalServerError' : 'ClientError';

    if (err.isOperational) {
      logger.warn('Operational error', {
        statusCode,
        message,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.error('Non-operational error', {
        statusCode,
        message,
        path: req.path,
        method: req.method,
        stack: err.stack,
      });
    }
  }
  // Mongoose ValidationError (e.g., missing required fields, invalid enum)
  else if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    errorType = 'ValidationError';
    message = 'Request validation failed';
    details = formatMongooseValidationError(err);

    logger.warn('Mongoose validation error', {
      path: req.path,
      method: req.method,
      details,
    });
  }
  // Mongoose CastError (e.g., invalid ObjectId)
  else if (err instanceof MongooseError.CastError) {
    statusCode = 400;
    errorType = 'CastError';
    message = `Invalid value for ${err.path}: ${err.value}`;

    logger.warn('Mongoose cast error', {
      path: req.path,
      field: err.path,
      value: err.value,
    });
  }
  // MongoDB duplicate key error (code 11000)
  else if ((err as any).code === 11000) {
    statusCode = 409;
    errorType = 'DuplicateKeyError';
    const keyValue = (err as any).keyValue || {};
    const duplicateField = Object.keys(keyValue)[0] || 'unknown';
    message = `Duplicate value for field: ${duplicateField}`;

    logger.warn('Duplicate key error', {
      path: req.path,
      field: duplicateField,
      value: keyValue[duplicateField],
    });
  }
  // SyntaxError from malformed JSON body
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    errorType = 'ParseError';
    message = 'Malformed JSON in request body';

    logger.warn('JSON parse error', { path: req.path });
  }
  // Generic / unknown errors
  else {
    logger.error('Unhandled error', {
      name: err.name,
      message: err.message,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
  }

  // Build the response
  const response: ErrorResponse = {
    error: errorType,
    message,
  };

  if (details) {
    response.details = details;
  }

  // Include stack trace only in development
  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
