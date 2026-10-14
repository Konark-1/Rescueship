# tests/

> **Purpose**: Jest test suites — 61 test suites covering 525 tests for backend services, APIs, multi-carrier logistics hub, security, and verification workflows.  
> **Status**: **100% PASSING (61/61 suites, 525/525 tests)**.

## Verified Test Suites Catalog

| Test Suite | Functionality Area & Description | Status |
| :--- | :--- | :--- |
| `anti-exploitation.test.ts` | Webhook signature tampering, replay attacks, payload manipulation guards | **PASS** (15 tests) |
| `vulnerability-remediation.test.ts` | Input sanitization, NoSQL injection defenses, prototype pollution guards | **PASS** (14 tests) |
| `suppression-and-watchtower.test.ts` | High-risk pre-dispatch order suppression, LiveOps watchtower | **PASS** (9 tests) |
| `step1-core-hardening.test.ts` | Compound indexes, error type categorization, retry strategies | **PASS** (14 tests) |
| `business-logic-stress.test.ts` | High-throughput concurrent order processing and queue resilience | **PASS** (12 tests) |
| `enterprise-vectors.test.ts` | Advanced threat vector simulation, tenant credential boundary isolation | **PASS** (12 tests) |
| `red-team-hardening.test.ts` | Red-team penetration audit recommendations and hardened inputs | **PASS** (11 tests) |
| `merchant-separation.test.ts` | Strict multi-tenant data boundaries across queries and collections | **PASS** (16 tests) |
| `step4-export-stream.test.ts` | Streaming CSV/JSON export generation and CSV formula injection defense | **PASS** (8 tests) |
| `auth-and-access.test.ts` | JWT verification, token version invalidation on password change, tenant binding | **PASS** (8 tests) |
| `storefront-sync.test.ts` | E-commerce store webhooks, order creation, fulfillment updates | **PASS** (9 tests) |
| `shopify-lifecycle.test.ts` | Shopify app install/uninstall, client credentials token exchange, GDPR webhooks | **PASS** (7 tests) |
| `refund-and-gateway.test.ts` | Payment gateway webhooks, refund queue, merchant-only API keys | **PASS** (8 tests) |
| `pricing-consistency.test.ts` | Band-based tier pricing, order volume fee calculations | **PASS** (8 tests) |
| `free-test.service.test.ts` | Free test rescue simulation mechanics | **PASS** (5 tests) |
| `universal-order-ingestion.test.ts` | Universal order ingestion (Shopify & WooCommerce prepaid & COD), quarantined shipment linking | **PASS** (12 tests) |
| `auth.api.test.ts` | Merchant registration, login, Google OAuth, password reset, token revocation | **PASS** (10 tests) |
| `address-correction.service.test.ts` | 3-mode address engine: Nominatim geocoding, Gemini AI parsing, carrier sync | **PASS** (14 tests) |
| `ndr-hardening-edge-cases.test.ts` | 21 edge cases: cross-tenant, remark classification, timing, duplicates | **PASS** (21 tests) |
| `analytics.service.test.ts` | Dashboard metric calculations, conversion curves, carrier performance breakdown | **PASS** (15 tests) |
| `pre-delivery.service.test.ts` | Pre-delivery confirmation, buyer availability check | **PASS** (11 tests) |
| `order.service.test.ts` | COD conversion, payment link generation, platform sync | **PASS** (12 tests) |
| `webhook-security.test.ts` | HMAC signature validation for Shopify, Razorpay, Cashfree, Meta, Couriers | **PASS** (11 tests) |
| `sequential-ndr-funnel.test.ts` | Multi-stage interactive NDR resolution, button fallbacks, cancellation gates | **PASS** (16 tests) |
| `license-and-roi.test.ts` | ROI calculation formulas, freight savings attribution, weekly report metrics | **PASS** (14 tests) |
| `pincode-risk.service.test.ts` | Historical pincode risk evaluation, tier categorization | **PASS** (9 tests) |
| `dashboard-and-risk-actions.test.ts` | Action queue triage, SLA timers, bulk resolve | **PASS** (12 tests) |
| `plan-simulation-cases.test.ts` | Billing volume thresholds and plan recommendation algorithm | **PASS** (12 tests) |
| `ndr.service.test.ts` | Central NDR pipeline, remark classification, customer intent processing | **PASS** (15 tests) |
| `gaps-operational-hardening.test.ts` | COD adjustment, Sunday ROI, 72h expiry, state machine, RTO arrest | **PASS** (16 tests) |
| `backfill-pincodes.test.ts` | Historical pincode risk backfill script | **PASS** (4 tests) |
| `high-risk-pincodes.api.test.ts` | Pincode blacklisting/whitelisting API, dynamic risk rules | **PASS** (5 tests) |
| `ai-predictive-rto.test.ts` | Multi-factor RTO risk scoring: address, phone, pincode, order value | **PASS** (10 tests) |
| `analytics-enterprise-routes.test.ts` | Enterprise reporting endpoints, cohort drilldown, metric export filters | **PASS** (11 tests) |
| `multi-carrier-hub.test.ts` | Status normalization maps (8 couriers + custom), inbound webhook parsers | **PASS** (17 tests) |
| `health.api.test.ts` | Container /health and /live probes, dependency readiness | **PASS** (4 tests) |
| `merchant-digest.service.test.ts` | Event buffering, hourly aggregation, email dispatch, quota alerts | **PASS** (7 tests) |
| `logistics.service.test.ts` | Direct carrier dispatch, webhook-only safe execution, reattempt and address sync | **PASS** (12 tests) |
| `step2-infrastructure.test.ts` | BullMQ queue isolation, worker lifecycle, connection retry logic | **PASS** (10 tests) |
| `onboarding-smoke.test.ts` | End-to-end merchant onboarding flow smoke test | **PASS** (7 tests) |
| `shiprocket.parser.test.ts` | Shiprocket remark classification, status code mappings, fallback extraction | **PASS** (8 tests) |
| `email.service.test.ts` | SMTP delivery, transactional templates, fallback logging | **PASS** (4 tests) |
| `dashboard-attention.test.ts` | "Needs your attention" panel, broken connection surfacing, self-healing | **PASS** (6 tests) |
| `whatsapp.service.test.ts` | Meta Cloud API v22.0 message sending, media message handling, 4h cooldown | **PASS** (10 tests) |
| `geocoding.service.test.ts` | OpenStreetMap Nominatim reverse geocoding, 2-tier Redis + in-memory cache | **PASS** (6 tests) |
| `concurrency.test.ts` | Concurrent webhook race condition protection on status transitions | **PASS** (6 tests) |
| `subscription-lifecycle.test.ts` | SaaS billing plans, auto-debit, cycle renewal, quota enforcement | **PASS** (7 tests) |
| `idempotency.test.ts` | Redis SET NX claim locks, duplicate event suppression, TTL expiry | **PASS** (6 tests) |
| `no-raw-customer-copy.test.ts` | Raw copy bypass guards, ensures all buyer messages use registered templates | **PASS** (5 tests) |
| `security-vault.test.ts` | IDOR prevention, cross-tenant isolation, credential masking | **PASS** (7 tests) |
| `payment.service.test.ts` | Razorpay/Cashfree payment link creation, signature verification, webhook handling | **PASS** (8 tests) |
| `utilities.test.ts` | Common helper functions, number formatting, date helpers | **PASS** (6 tests) |
| `subscription-no-trial.test.ts` | Pay-first flow, 90-day money-back guarantee, upfront billing | **PASS** (6 tests) |
| `rate-limiting.test.ts` | Tiered IP/merchant rate limiters, burst defense | **PASS** (6 tests) |
| `template-registry.test.ts` | Meta WhatsApp template catalog, multilingual localization, component variable injection | **PASS** (8 tests) |
| `encryption.service.test.ts` | AES-256-GCM encryption/decryption, legacy cipher migration | **PASS** (6 tests) |
| `connection-health.test.ts` | Real-time connection diagnostic checks for Shopify, WhatsApp, Carrier, Payment | **PASS** (8 tests) |
| `shiprocket-alias.test.ts` | Webhook alias endpoint, signature validation, idempotency | **PASS** (6 tests) |
| `customer-copy-guard.test.ts` | Anti-accusatory language rejection, respectful customer messaging | **PASS** (4 tests) |
| `phoneNormalizer.test.ts` | Indian E.164 phone normalization across formats (+91, 0-prefix, spaces) | **PASS** (11 tests) |
| `setup-status.test.ts` | Merchant setup checklist, wizard progression state | **PASS** (6 tests) |

## Key Invariants

- ALL 61 suites / 525 tests MUST pass before any deploy (`npm test`)
- Run with: `npm test` (configured with `jest --forceExit`)
- Tests use in-memory mocks — do NOT connect to real external MongoDB/Redis
- Config: `jest.config.ts` in project root, uses `ts-jest`

## Agent Cheat Sheet

- To add tests: Create `yourservice.test.ts`, mock Mongoose models and Redis
- To run single suite: `npx jest tests/yourservice.test.ts --forceExit`
- To run all: `npm test`
