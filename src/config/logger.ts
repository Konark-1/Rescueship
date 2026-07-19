import { logger, createChildLogger } from '../utils/logger';

export default logger;

/**
 * Helper to create a child logger with a module label.
 * Resolves compatibility with middleware importing `createLogger` from `@config/logger`.
 */
export function createLogger(label: string) {
  return createChildLogger({ module: label });
}
