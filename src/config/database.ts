/**
 * @fileoverview MongoDB connection manager for RescueShip.
 *
 * Provides a `connectDatabase()` function that establishes a Mongoose connection
 * with automatic retry logic (configurable retries, 5 s delay). Logs lifecycle
 * events and registers a graceful-shutdown handler so in-flight operations can
 * complete before the process exits.
 *
 * Usage:
 * ```ts
 * import { connectDatabase } from '@config/database';
 * await connectDatabase();
 * ```
 */

import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Maximum number of connection attempts before giving up. */
const MAX_RETRIES = 3;

/** Delay in milliseconds between retry attempts. */
const RETRY_DELAY_MS = 5_000;

/* ------------------------------------------------------------------ */
/*  Connection event listeners (registered once)                       */
/* ------------------------------------------------------------------ */

let listenersRegistered = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    logger.info('✅  MongoDB connected successfully');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('❌  MongoDB connection error', { error: err.message });
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('🔄  MongoDB reconnected');
  });
}

/* ------------------------------------------------------------------ */
/*  Graceful shutdown                                                  */
/* ------------------------------------------------------------------ */

let shutdownRegistered = false;

/**
 * Registers SIGINT / SIGTERM handlers that close the Mongoose connection
 * before the process exits.  Registered once on first call.
 */
function registerShutdownHandler(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`📴  Received ${signal} — closing MongoDB connection…`);
    try {
      await mongoose.connection.close();
      logger.info('🛑  MongoDB connection closed cleanly');
    } catch (err) {
      logger.error('Failed to close MongoDB connection', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Connects to MongoDB with retry logic.
 *
 * @param retries - Number of remaining connection attempts (default: {@link MAX_RETRIES}).
 * @throws Exits the process with code 1 after all retries are exhausted.
 *
 * @example
 * ```ts
 * await connectDatabase();
 * ```
 */
export async function connectDatabase(retries: number = MAX_RETRIES): Promise<void> {
  registerConnectionListeners();
  registerShutdownHandler();

  const mongooseOptions: mongoose.ConnectOptions = {
    // Mongoose 7+ no longer needs useNewUrlParser / useUnifiedTopology
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(
        `🔌  Connecting to MongoDB (attempt ${attempt}/${retries})…`,
        { uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@') },
      );

      await mongoose.connect(config.mongodb.uri, mongooseOptions);
      return; // success — exit the function
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed`, {
        error: errorMessage,
      });

      if (attempt < retries) {
        logger.info(`⏳  Retrying in ${RETRY_DELAY_MS / 1_000}s…`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // All retries exhausted
  logger.error(
    `🚨  Unable to connect to MongoDB after ${retries} attempts — shutting down`,
  );
  process.exit(1);
}

/**
 * Disconnects from MongoDB. Useful in tests or manual shutdown flows.
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected via disconnectDatabase()');
}
