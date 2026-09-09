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
/*  Redaction                                                          */
/* ------------------------------------------------------------------ */

/** Metadata keys whose values are always replaced. Matched case-insensitively as substrings. */
const SECRET_KEY_PATTERNS = [
  'password', 'passwd', 'secret', 'token', 'authorization', 'apikey', 'api_key',
  'keysecret', 'key_secret', 'clientsecret', 'client_secret', 'credential', 'signature', 'hmac',
];
/** Metadata keys treated as PII phone numbers and masked to the last 4 digits. */
const PHONE_KEY_PATTERNS = ['phone', 'msisdn', 'mobile', 'from', 'to', 'recipient', 'wa_id'];
/** Keys that look like secrets but are safe identifiers (never redact). */
const SAFE_KEYS = new Set(['tokenversion', 'tokenpresent', 'merchanttokenversion', 'hastoken', 'hassignature', 'phonenumberid', 'phonehash']);

const MAX_DEPTH = 6;

/** Mask a phone number to its last 4 digits: +919876543210 → ***3210 */
export function maskPhone(phone: unknown): string {
  if (phone === undefined || phone === null) return '';
  const s = String(phone);
  const digits = s.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `***${digits.slice(-4)}`;
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  const k = key.toLowerCase();
  if (SAFE_KEYS.has(k)) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    if (SECRET_KEY_PATTERNS.some((p) => k.includes(p))) return '[REDACTED]';
    if (PHONE_KEY_PATTERNS.some((p) => k === p || k.endsWith(p) || k.startsWith(p))) {
      // Only mask if it actually looks like a phone number (>=7 digits)
      const digits = String(value).replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15 && /^[\d\s+()-]+$/.test(String(value))) return maskPhone(value);
    }
    return value;
  }
  return redactObject(value, depth + 1);
}

function redactObject(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || input === null || typeof input !== 'object') return input;
  if (input instanceof Error) return { name: input.name, message: input.message, stack: input.stack };
  if (Array.isArray(input)) return input.map((v) => redactObject(v, depth + 1));
  if (Buffer.isBuffer(input)) return `[Buffer ${input.length}b]`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = redactValue(k, v, depth);
  }
  return out;
}

/** Winston format that redacts secrets/PII from log metadata (not the message string). */
const redactFormat = winston.format((info) => {
  const { level, message, timestamp, service, ...meta } = info as Record<string, unknown>;
  const cleaned = redactObject(meta) as Record<string, unknown>;
  for (const key of Object.keys(meta)) delete (info as Record<string, unknown>)[key];
  return Object.assign(info, cleaned);
})();

/* ------------------------------------------------------------------ */
/*  Formats                                                            */
/* ------------------------------------------------------------------ */

/**
 * Human-readable format for development:
 * `2026-06-26 14:30:00 [info]: Server started { port: 3000 }`
 */
const devFormat = winston.format.combine(
  redactFormat,
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
  redactFormat,
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
