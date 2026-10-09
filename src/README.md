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
| `__tests__/` | Jest tests | 49 suites, 415 tests (100% passing) |

## ⚡ Instant Architecture & Multi-Tenancy Cheat Sheet (Fast Lookup)

Never scan through multiple files to verify system logic. Use this reference matrix:

| Subsystem | Primary Code Location | Multi-Tenant Enforcement Mechanism |
| :--- | :--- | :--- |
| **Settings & Discounts** | [`src/api/settings.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/settings.api.ts) | Scoped strictly to `req.merchant.merchantId` from verified JWT. Mutates only `Merchant.findById(merchantId)`. |
| **Credentials Vault** | [`src/models/Merchant.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/models/Merchant.ts)<br>[`src/services/encryption.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/encryption.service.ts) | Stored encrypted with AES-256-GCM. Redacted as `********` via `toSettingsDto()` on GET. |
| **Phone Number Collision** | [`src/api/settings.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/settings.api.ts#L314) | Checks `Merchant.findOne({ _id: { $ne: merchant._id }, 'whatsappConfig.phoneNumberId' })` -> throws **409 Conflict**. |
| **COD Conversion Logic** | [`src/services/order.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/order.service.ts#L214) | Computes discount and links strictly against `merchant.settings.codConversion` of the owning store. |
| **Outbound WhatsApp** | [`src/services/whatsapp.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/whatsapp.service.ts#L86)<br>[`src/services/whatsapp/whatsapp-dispatcher.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/whatsapp/whatsapp-dispatcher.service.ts) | Uses decrypted merchant credentials only. Strictly blocks fallback to platform WABA for customer messages. |
| **Inbound WhatsApp** | [`src/webhooks/whatsapp.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/whatsapp.webhook.ts#L130) | Resolves merchant from `metadata.phone_number_id` sent by Meta; scopes all message logs to that tenant. |
| **Store Webhooks** | [`src/webhooks/shopify.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/shopify.webhook.ts)<br>[`src/webhooks/woocommerce.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/woocommerce.webhook.ts) | Shopify derives tenant from signed shop domain. WooCommerce verifies per-merchant HMAC with `merchant_id`. |
| **Payment Webhooks** | [`src/webhooks/razorpay.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/razorpay.webhook.ts)<br>[`src/webhooks/cashfree.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/cashfree.webhook.ts) | Derives owning merchant by resolving `paymentLinkId` against `Order` collection, then verifies per-merchant HMAC. |
| **Carrier Webhooks** | [`src/webhooks/carrier-auth.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/carrier-auth.ts) | Authenticates inbound NDR using per-tenant `carrierConfig.webhookSecret`. |
| **Orders & Dispute Chats** | [`src/api/orders.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/orders.api.ts) | `Order.find({ merchantId })` & `MessageLog.find({ merchantId })`. Cross-tenant queries return 404. |
| **Templates Sandbox** | [`src/api/templates.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/templates.api.ts) | Every CRUD operation scoped by `{ merchantId }`. Merchants cannot read, modify, or delete foreign playbooks. |

## 🧪 Testing Command Guidelines

Always append `--forceExit` when running single test files so Jest closes background open handles immediately:
```bash
# Full test suite (includes --forceExit by default)
npm test

# Single test file (ALWAYS use --forceExit to prevent background hanging)
npx jest src/__tests__/merchant-separation.test.ts --forceExit
```

## Key Invariants

- Every DB query MUST scope to `merchantId` (tenant isolation)
- All third-party secrets encrypted via AES-256-GCM before storage
- Webhook endpoints MUST verify HMAC signatures or tenant authentication tokens
- Universal Order Ingestion: Store both prepaid and COD orders to preserve phone numbers for carrier NDR matching
- Workers MUST check `merchant.settings.globalPause` before dispatching
- `npm test` must pass 49 suites / 415 tests before deploy
- `npm run build` (tsc) must produce zero errors
