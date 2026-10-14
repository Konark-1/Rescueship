# utils/

> **Purpose**: Core utility libraries — circuit breaker, idempotency, logging, phone normalization, and copy governance.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `circuit-breaker.ts` | Tenant failure tracking | `TenantCircuitBreaker` — trips after 5 failures, 15-min cooldown, fires security alerts |
| `customer-copy-guard.ts` | Copy linter | `assertSafeCopy(s)`, `scanCustomerCopy(strings[])` — blocks accusatory language |
| `idempotency.ts` | Dedup guard | `IdempotencyGuard` — atomic Redis `SET NX` claims: `claim()`, `release()`, `markProcessed()` |
| `job-id.ts` | BullMQ job IDs | `makeJobId(...parts)` — sanitized IDs joined with `__` (no colons) |
| `logger.ts` | Winston logger | `logger`, `maskPhone(phone)`, `createChildLogger(meta)` — auto PII redaction |
| `phoneNormalizer.ts` | Phone normalization | `normalizeIndianPhone(phone)`, `isValidIndianPhone(phone)` |

## Key Invariants

- `maskPhone()` MUST be used before logging any phone number
- `IdempotencyGuard.claim()` MUST be called before processing any webhook event
- `TenantCircuitBreaker` trips on 5 consecutive failures — blocks outbound for 15 minutes
- `makeJobId()` joins with `__` separator — BullMQ throws on colons in job IDs
- `customer-copy-guard` blocks words: "lied", "never came", "fraud", etc.
- `normalizeIndianPhone` outputs clean 12-digit `91XXXXXXXXXX` format

## Verified Tests & Status

| Test Suite | Tests Covered | Status |
| :--- | :--- | :--- |
| `utilities.test.ts` | Common helper functions, number formatting, date helpers | **PASS** (6/6 passed) |
| `phoneNormalizer.test.ts` | Indian E.164 phone normalization across formats (+91, 0-prefix, spaces) | **PASS** (11/11 passed) |
| `customer-copy-guard.test.ts` | Linter checks for accusatory language | **PASS** (4/4 passed) |
| `idempotency.test.ts` | Redis SET NX claim locks, duplicate event suppression | **PASS** (6/6 passed) |

