/**
 * @fileoverview Centralized environment configuration for RescueShip.
 *
 * Loads all environment variables from `.env` via dotenv and exports a strongly-typed
 * `config` object. On import, the module validates that every required variable is
 * present; if any are missing the process exits with a descriptive error message.
 *
 * Usage:
 * ```ts
 * import { config } from '@config/env';
 * console.log(config.server.port); // 3000
 * ```
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

/** Server-related configuration. */
export interface ServerConfig {
  nodeEnv: string;
  port: number;
  apiBaseUrl: string;
}

/** MongoDB configuration. */
export interface MongoDBConfig {
  uri: string;
}

/** Redis configuration. */
export interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
}

/** JWT authentication configuration. */
export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

/** AES encryption configuration for merchant API keys. */
export interface EncryptionConfig {
  key: string;
}

/** Meta WhatsApp Cloud API configuration. */
export interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
}

/** Razorpay payment gateway configuration. */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** Cashfree payment gateway configuration. */
export interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}

/** Shiprocket carrier integration configuration. */
export interface ShiprocketConfig {
  email: string;
  password: string;
}

/** Shopify app-level configuration (not per-merchant). */
export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
}

/** Logging configuration. */
export interface LoggingConfig {
  level: string;
}

/** Root configuration object combining every category. */
export interface AppConfig {
  server: ServerConfig;
  mongodb: MongoDBConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  encryption: EncryptionConfig;
  whatsapp: WhatsAppConfig;
  razorpay: RazorpayConfig;
  cashfree: CashfreeConfig;
  shiprocket: ShiprocketConfig;
  shopify: ShopifyConfig;
  logging: LoggingConfig;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Reads an environment variable.
 * Throws a descriptive error if the variable is required and missing.
 */
function getEnv(key: string, required: true): string;
function getEnv(key: string, required: false, fallback?: string): string;
function getEnv(key: string, required: boolean, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (required) {
    // We collect all missing vars first, so we throw in `validateConfig`.
    return '';
  }
  return fallback ?? '';
}

/**
 * Validate that all required environment variables are set.
 * Exits the process with code 1 if any are missing.
 */
function validateRequiredVars(requiredKeys: string[]): void {
  const missing = requiredKeys.filter((key) => {
    const v = process.env[key];
    return v === undefined || v === '';
  });

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\n❌  Missing required environment variables:\n${missing.map((k) => `   • ${k}`).join('\n')}\n\nCopy .env.example → .env and fill in the values.\n`,
    );
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Validation & Config Construction                                   */
/* ------------------------------------------------------------------ */

/** Environment variables that MUST be set for the app to boot. */
const REQUIRED_VARS: string[] = [
  'MONGODB_URI',
  'REDIS_HOST',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
];

validateRequiredVars(REQUIRED_VARS);

/**
 * Fully-typed, validated application configuration.
 *
 * All values are read once at startup — they are **not** re-read on every access.
 * Restart the process to pick up changes in `.env`.
 */
export const config: AppConfig = {
  server: {
    nodeEnv: getEnv('NODE_ENV', false, 'development'),
    port: parseInt(getEnv('PORT', false, '3000'), 10),
    apiBaseUrl: getEnv('API_BASE_URL', false, 'http://localhost:3000'),
  },

  mongodb: {
    uri: getEnv('MONGODB_URI', true),
  },

  redis: {
    host: getEnv('REDIS_HOST', false, 'localhost'),
    port: parseInt(getEnv('REDIS_PORT', false, '6379'), 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: getEnv('JWT_SECRET', true),
    expiresIn: getEnv('JWT_EXPIRES_IN', false, '7d'),
  },

  encryption: {
    key: getEnv('ENCRYPTION_KEY', true),
  },

  whatsapp: {
    apiVersion: getEnv('WHATSAPP_API_VERSION', false, 'v22.0'),
    phoneNumberId: getEnv('WHATSAPP_PHONE_NUMBER_ID', true),
    accessToken: getEnv('WHATSAPP_ACCESS_TOKEN', true),
    verifyToken: getEnv('WHATSAPP_VERIFY_TOKEN', true),
    appSecret: getEnv('WHATSAPP_APP_SECRET', true),
  },

  razorpay: {
    keyId: getEnv('RAZORPAY_KEY_ID', false, ''),
    keySecret: getEnv('RAZORPAY_KEY_SECRET', false, ''),
    webhookSecret: getEnv('RAZORPAY_WEBHOOK_SECRET', false, ''),
  },

  cashfree: {
    clientId: getEnv('CASHFREE_CLIENT_ID', false, ''),
    clientSecret: getEnv('CASHFREE_CLIENT_SECRET', false, ''),
    apiVersion: getEnv('CASHFREE_API_VERSION', false, '2023-08-01'),
  },

  shiprocket: {
    email: getEnv('SHIPROCKET_EMAIL', false, ''),
    password: getEnv('SHIPROCKET_PASSWORD', false, ''),
  },

  shopify: {
    apiKey: getEnv('SHOPIFY_API_KEY', false, ''),
    apiSecret: getEnv('SHOPIFY_API_SECRET', false, ''),
  },

  logging: {
    level: getEnv('LOG_LEVEL', false, 'debug'),
  },
};

/** Helper: returns `true` when `NODE_ENV` is `'production'`. */
export const isProduction = (): boolean => config.server.nodeEnv === 'production';

/** Helper: returns `true` when `NODE_ENV` is `'development'`. */
export const isDevelopment = (): boolean => config.server.nodeEnv === 'development';
