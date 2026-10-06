# src/

> **Purpose**: Backend root — Express 5 + TypeScript server powering the RescueShip COD rescue engine.

## Entry Point

`index.ts` — Boots Express 5, connects MongoDB + Redis, registers middleware pipeline (Helmet → CORS → mongo-sanitize → HPP → JSON body → rate limiters), mounts API routers under `/api/*`, webhook routers under `/webhooks/*`, SSE under `/api/realtime`, serves `src/public/` static files, starts BullMQ workers, listens on PORT.

## Directory Map

| Directory | Role | Details |
|-----------|------|---------|
| `api/` | REST controllers | 13 route modules (auth, orders, analytics, billing, connect, settings, templates, sandbox, export, metrics, realtime, auditlogs, plg) |
| `config/` | Configuration | Env parsing, DB/Redis connections, rescue policy, startup validator |
| `i18n/` | Copy governance | Non-accusatory customer messages, multilingual templates |
| `jobs/` | BullMQ workers | 12 workers + cron schedulers (COD, NDR, escalation, reconciliation, ROI reports) |
| `middleware/` | Express middleware | Auth JWT, HMAC verification, rate limiting, plan gating, Zod validation, error handler |
| `models/` | Mongoose schemas | 12 models with compound indexes, TTL rules, immutable audit hooks |
| `public/` | Static demo UI | Dev health dashboard and mock Shopify checkout |
| `schemas/` | Zod validators | Webhook payload schemas (Shiprocket, WhatsApp, Razorpay, Shopify) |
| `scripts/` | Admin CLI | License grants, simulation, key updates |
| `services/` | Business logic | 30+ services with subdirs: analytics/, courier/, state-machine/, whatsapp/ (Multi-carrier hub, NDR pipelines, address AI, prepaid remark sanitization, financial attribution) |
| `templates/` | WhatsApp templates | 4 Meta-approved JSON payloads (COD + NDR, English + Hindi) |
| `types/` | TypeScript types | `ErrorType` enum, `AppError` class |
| `utils/` | Utilities | Circuit breaker, idempotency, logger, phone normalizer |
| `webhooks/` | Webhook handlers | 15 handlers (Shopify & WooCommerce universal ingestion for prepaid & COD, Shiprocket, Delhivery, Blue Dart, Xpressbees, Shadowfax, Ecom Express, DTDC, ClickPost, WhatsApp/Meta, Razorpay, Cashfree, Payment, Custom) |
| `__tests__/` | Jest tests | 40 suites, 334 tests |

## Key Invariants

- Every DB query MUST scope to `merchantId` (tenant isolation)
- All third-party secrets encrypted via AES-256-GCM before storage
- Webhook endpoints MUST verify HMAC signatures or tenant authentication tokens
- Universal Order Ingestion: Store both prepaid and COD orders to preserve phone numbers for carrier NDR matching
- Workers MUST check `merchant.settings.globalPause` before dispatching
- `npm test` must pass 40 suites / 334 tests before deploy
- `npm run build` (tsc) must produce zero errors
