/**
 * error.types.ts
 * Enterprise Error Taxonomy for RescueShip
 */

export enum ErrorType {
  RETRYABLE = 'RETRYABLE',         // Network timeout, 503, 429
  NON_RETRYABLE = 'NON_RETRYABLE', // 400, 401, 403, invalid data/syntax
  CONFLICT = 'CONFLICT',           // Duplicate, concurrency, race condition
  STALE = 'STALE',                 // Late out-of-order event
}

export class AppError extends Error {
  public readonly errorType: ErrorType;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, errorType: ErrorType = ErrorType.NON_RETRYABLE, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'AppError';
    this.errorType = errorType;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
