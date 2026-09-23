# __tests__/

> **Purpose**: Jest test suites — 18 suites covering 116 tests for backend services, APIs, and security.

## File Catalog

| File | Tests |
|------|-------|
| `analytics.service.test.ts` | Dashboard metrics, daily conversions, carrier performance |
| `auth.api.test.ts` | Registration, login, Google OAuth, password reset, token revocation |
| `customer-copy-guard.test.ts` | Accusatory language detection and rejection |
| `email.service.test.ts` | Gmail OAuth2 delivery, SMTP fallback, template rendering |
| `encryption.service.test.ts` | AES-256-GCM encrypt/decrypt roundtrip, key rotation |
| `gaps-operational-hardening.test.ts` | COD adjustment, Sunday ROI, 72h expiry, state machine, RTO arrest |
| `idempotency.test.ts` | Redis SET NX claims, duplicate detection, TTL expiry |
| `license-and-roi.test.ts` | License grant, ROI calculation, weekly report metrics |
| `mockApis.test.ts` | External API mock validation (Shiprocket, Razorpay, Meta) |
| `ndr-hardening-edge-cases.test.ts` | 21 edge cases: cross-tenant, remark classification, timing, duplicates |
| `ndr.service.test.ts` | Full NDR pipeline: 3-mode address correction, button replies, cancel |
| `no-raw-customer-copy.test.ts` | Ensures no inline strings bypass copy governance |
| `order.service.test.ts` | COD conversion, payment confirmation, platform sync |
| `payment.service.test.ts` | Razorpay/Cashfree link generation, signature verification |
| `phoneNormalizer.test.ts` | Indian phone normalization (+91, 0-prefix, whitespace) |
| `plan-simulation-cases.test.ts` | 12 plan simulation cases across Starter/Growth/Scale/Fleet |
| `security-vault.test.ts` | IDOR prevention, cross-tenant isolation, credential masking |
| `whatsapp.service.test.ts` | Template dispatch, cooldown enforcement, credit deduction |

## Key Invariants

- ALL 18 suites / 116 tests MUST pass before any deploy
- Run with: `npm test` (uses `jest --forceExit`)
- Tests use in-memory mocks — do NOT connect to real MongoDB/Redis
- Config: `jest.config.ts` in project root, uses `ts-jest`

## Agent Cheat Sheet

- To add tests: Create `yourservice.test.ts`, mock Mongoose models and Redis
- To run single suite: `npx jest --testPathPattern=yourservice`
- To run all: `npm test`
