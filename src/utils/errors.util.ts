/**
 * errors.util.ts
 * Custom application and infrastructure error classes.
 */

export class CarrierRateLimitError extends Error {
  public readonly statusCode: number = 429;

  constructor(message: string = 'Carrier Rate Limit Exceeded (429)') {
    super(message);
    this.name = 'CarrierRateLimitError';
    Object.setPrototypeOf(this, CarrierRateLimitError.prototype);
  }
}
