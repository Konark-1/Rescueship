/**
 * @fileoverview Winston logger for RescueShip.
 *
 * Exports a pre-configured `logger` instance that:
 * - Outputs **colorized, human-readable** logs in development.
 * - Outputs **structured JSON** logs in production (easy for log aggregators).
 * - Includes a timestamp and the service name `rescueship` on every entry.
 *
 * Usage:
 * ```ts
 * import { logger } from '@utils/logger';
 * logger.info('Server started', { port: 3000 });
 * logger.error('Oops', { error: err.message });
 * ```
 */

import winston from 'winston';

/* ------------------------------------------------------------------ */
/*  Determine environment                                              */
/* ------------------------------------------------------------------ */

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
const IS_PRODUCTION = NODE_ENV === 'production';

/* ------------------------------------------------------------------ */
/*  Formats                                                            */
/* ------------------------------------------------------------------ */

/**
 * Human-readable format for development:
 * `2026-06-26 14:30:00 [info]: Server started { port: 3000 }`
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

/**
 * Structured JSON format for production / log aggregators.
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD\'T\'HH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

/* ------------------------------------------------------------------ */
/*  Transports                                                         */
/* ------------------------------------------------------------------ */

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: LOG_LEVEL,
    handleExceptions: true,
    handleRejections: true,
  }),
];

/* ------------------------------------------------------------------ */
/*  Logger instance                                                    */
/* ------------------------------------------------------------------ */

/**
 * Application-wide Winston logger.
 *
 * @example
 * ```ts
 * logger.info('Order processed', { orderId: '123', merchantId: '456' });
 * logger.warn('Rate limit approaching', { remaining: 5 });
 * logger.error('Payment failed', { error: err.message, stack: err.stack });
 * ```
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'rescueship' },
  format: IS_PRODUCTION ? prodFormat : devFormat,
  transports,
  exitOnError: false,
});

/**
 * Creates a child logger with additional default metadata.
 *
 * Useful when a module wants every log line to carry context automatically.
 *
 * @param meta - Key-value pairs merged into every log entry.
 * @returns A new Winston logger instance.
 *
 * @example
 * ```ts
 * const log = createChildLogger({ module: 'whatsapp-webhook' });
 * log.info('Payload received'); // includes { service: 'rescueship', module: 'whatsapp-webhook' }
 * ```
 */
export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}
