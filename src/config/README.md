# config/

> **Purpose**: Central configuration — environment variables, database/Redis connections, rescue policy defaults, and startup validation.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `env.ts` | Environment parser | `config: AppConfig`, `isProduction()`, `isDevelopment()`, `frontendOrigin()` |
| `database.ts` | MongoDB connection | `connectDatabase(retries?)`, `disconnectDatabase()` |
| `redis.ts` | Redis connection | `redisConnection: Redis`, `connectRedis()`, `disconnectRedis()` |
| `logger.ts` | Logger factory | `default logger`, `createLogger(label)` |
| `order-status.ts` | Status constants | `ORDER_STATUS` enum object, `terminalOutcome(status)` |
| `rescue-policy.ts` | Policy engine | `RescuePolicy` interface, `defaultRescuePolicy()`, `getPolicy()`, `validatePolicy()` |
| `startup-validator.ts` | Boot checks | `validateEnvironment()` — exits on missing critical env vars |

## Key Invariants

- `redisConnection` MUST use `maxRetriesPerRequest: null` for BullMQ compatibility
- `connectDatabase()` retries 3 times with 5s delay before fatal exit
- `rescue-policy.ts` enforces `tone.accusatory === false` (never accuse couriers)
- `startup-validator.ts` blocks boot if `JWT_SECRET`, `ENCRYPTION_KEY`, or `MONGODB_URI` missing
- `ORDER_STATUS` defines the ONLY valid order statuses — do NOT add statuses elsewhere

## Verified Tests & Status

| Test Suite | Tests Covered | Status |
| :--- | :--- | :--- |
| `step2-infrastructure.test.ts` | MongoDB/Redis connection lifecycle, fallback retry logic, graceful disconnection | **PASS** (10/10 passed) |
| `idempotency.test.ts` | Redis SET NX claim locks, duplicate event suppression, TTL expiry | **PASS** (6/6 passed) |
| `startup-validator` | Critical environment variable verification, safe production warnings, Render boot safety | **PASS** (Verified in CI & Production) |

## Agent Cheat Sheet

- To add a new env var: Add to `AppConfig` interface in `env.ts`, add validation in `startup-validator.ts`
- To add a new order status: Add to `ORDER_STATUS` in `order-status.ts`, update `terminalOutcome()` mapping
- To change default rescue policy: Modify `defaultRescuePolicy()` in `rescue-policy.ts`
