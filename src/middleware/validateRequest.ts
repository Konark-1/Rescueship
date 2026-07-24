import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware to validate request body against a Zod schema.
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid request body',
          details: (error as any).issues?.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })) || [],
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Express middleware to validate request query parameters against a Zod schema.
 */
export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid query parameters',
          details: (error as any).issues?.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })) || [],
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Express middleware to validate request path parameters against a Zod schema.
 */
export const validateParams = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.params);
      req.params = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid route parameters',
          details: (error as any).issues?.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })) || [],
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Express middleware to validate multiple request components (body, query, params) against Zod schemas.
 */
export const validateRequest = (schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery as any;
      }
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Validation failed',
          details: (error as any).issues?.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })) || [],
        });
        return;
      }
      next(error);
    }
  };
};
