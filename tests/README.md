# tests/

> **Purpose**: Jest test suites — 49 suites covering 415 tests for backend services, APIs, multi-carrier logistics hub, security, and verification scripts.

## File Catalog

| File | Tests |
|------|-------|
| `multi-carrier-hub.test.ts` | Status normalization maps (8 couriers + custom), inbound webhook parsers (Blue Dart, Xpressbees, Shadowfax, Ecom Express, DTDC, Custom), multi-carrier credential persistence, disconnect isolation, dynamic multi-carrier action dispatching |
| `logistics.service.test.ts` | Direct carrier dispatch, webhook-only safe execution, reattempt and address sync |
| `sequential-ndr-funnel.test.ts` | Multi-stage interactive NDR resolution, WhatsApp button fallbacks, cancellation gates |
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
| `geocoding.service.test.ts` | Two-tier Redis + in-memory caching & Nominatim rate-limiting |
| `security-vault.test.ts` | IDOR prevention, cross-tenant isolation, credential masking |
| `vulnerability-remediation.test.ts` | Security remediations, input sanitation, session management |
| `merchant-digest.service.test.ts` | Event buffering, hourly aggregation, email dispatch, quota alerts |
| `webhook-security.test.ts` | HMAC validation, replay protection, multi-tenant secret isolation |
| `universal-order-ingestion.test.ts` | Universal order ingestion (WooCommerce & Shopify prepaid & COD), phone normalization, quarantined shipment linking, prepaid courier remark sanitization, and financial attribution metrics (reschedule, address updates, RTO arrest) |
| `subscription-lifecycle.test.ts` | SaaS billing plans, quota enforcement, upgrade/downgrade |
| `whatsapp.service.test.ts` | Template dispatch, cooldown enforcement, credit deduction |

## Key Invariants

- ALL 40 suites / 334 tests MUST pass before any deploy
- Run with: `npm test` (uses `jest --forceExit`)
- Tests use in-memory mocks — do NOT connect to real MongoDB/Redis
- Config: `jest.config.ts` in project root, uses `ts-jest`

## Agent Cheat Sheet

- To add tests: Create `yourservice.test.ts`, mock Mongoose models and Redis
- To run single suite: `npx jest --testPathPattern=yourservice`
- To run all: `npm test`
