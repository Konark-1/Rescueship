# api/

> **Purpose**: REST API route controllers — Express routers handling authenticated merchant requests and public endpoints.

## File Catalog

| File | Role | Key Endpoints |
|------|------|---------------|
| `analytics.api.ts` | Dashboard metrics | `GET /dashboard`, `GET /carriers` (Growth+ gated) |
| `auditlogs.api.ts` | Audit trail | `GET /` (paginated) |
| `auth.api.ts` | Authentication | `POST /register`, `/login`, `/google`, `/logout`, `/change-password`, `/forgot-password`, `/reset-password` |
| `billing.api.ts` | Subscriptions | `GET /usage`, `/plan`, `/status`, `POST /checkout`, `/checkout/verify` |
| `connect.api.ts` | Onboarding wizard | 20+ endpoints for Store/WhatsApp/Carrier/Payment integration |
| `export.api.ts` | Data export | `GET /:type` (CSV/JSON, Scale+ gated) |
| `metrics.api.ts` | Performance | `GET /my`, `GET /cohort` (admin only) |
| `orders.api.ts` | Order management & dispute resolution | `GET /`, `GET /:id`, `GET /export/csv`, `GET /chats/recent`, `POST /:orderId/resend-payment-link`, `POST /:orderId/reconcile-utr` |
| `plg.api.ts` | PLG self-serve | `POST /signup`, `GET /validate-token`, `POST /activate` (public) |
| `realtime.api.ts` | SSE streaming | `GET /stream` (10-min cap), `GET /status` |
| `sandbox.api.ts` | Test environment | `POST /simulate-ndr`, `/toggle`, `/graduate` |
| `settings.api.ts` | Configuration | `GET /`, `PUT /` (single-select COD incentive strategy with rupee cap), `POST /custom-api-secret/rotate` |
| `templates.api.ts` | WhatsApp recovery playbooks | CRUD, `POST /:id/submit`, `POST /sync-meta`, `POST /test-send` |

## Architecture & Data Flow

All routers import `authenticateToken` from `../middleware/auth` (except `plg.api.ts` public endpoints). They query Mongoose models from `../models/` and delegate business logic to services in `../services/`. Rate limiting via `../middleware/rateLimiter` and `../middleware/merchant-rate-limiter`.

## Key Invariants

- Every query MUST filter by `req.merchant.merchantId` extracted strictly from cryptographically verified JWT (IDOR prevention)
- Never accept `merchantId` in request body or path for mutations — always bind to authenticated session
- WhatsApp `phoneNumberId` updates check uniqueness across all accounts -> throws `409 Conflict` on duplicate claim
- Credentials in responses MUST be masked as `********` via `toSettingsDto()`
- Plan-gated features use `requireFeature()` from `../middleware/planGating.middleware`
- CSV exports MUST sanitize for formula injection (DDE escaping)
- Password reset tokens: SHA-256 hashed, 15-min expiry, single-use

## Agent Cheat Sheet

- To add a new endpoint: Create `yourfeature.api.ts`, export default router, mount in `../index.ts` under `/api/yourfeature`
- To add plan gating: Wrap route with `requireFeature('feature_name')`
- To add rate limiting: Use `standardMerchantLimiter` for normal, `credentialValidationLimiter` for sensitive ops
