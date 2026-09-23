# types/

> **Purpose**: TypeScript type definitions — custom error classes and domain types.

## File Catalog

| File | Key Exports |
|------|-------------|
| `error.types.ts` | `enum ErrorType` (`RETRYABLE`, `NON_RETRYABLE`, `CONFLICT`, `STALE`), `class AppError extends Error` |

## Usage

- `RETRYABLE`: Network timeouts, 503, 429 — BullMQ will retry
- `NON_RETRYABLE`: 400, 401, 403, invalid data — BullMQ will NOT retry
- `CONFLICT`: Duplicate, concurrency, race condition
- `STALE`: Late out-of-order webhook event — silently dropped

## Agent Cheat Sheet

- Use `AppError` with appropriate `ErrorType` for all service-level errors
- BullMQ workers check `ErrorType.RETRYABLE` to decide retry behavior
- `AppError` exposes `errorType`, `statusCode`, and optional `details`
