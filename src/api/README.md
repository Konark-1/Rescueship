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
| `orders.api.ts` | Order management | `GET /`, `GET /:id`, `GET /export/csv` |
| `plg.api.ts` | PLG self-serve | `POST /signup`, `GET /validate-token`, `POST /activate` (public) |
| `realtime.api.ts` | SSE streaming | `GET /stream` (10-min cap), `GET /status` |
| `sandbox.api.ts` | Test environment | `POST /simulate-ndr`, `/toggle`, `/graduate` |
| `settings.api.ts` | Configuration | `GET /`, `PUT /`, `POST /custom-api-secret/rotate` |
| `templates.api.ts` | WhatsApp templates | CRUD + `POST /:id/submit` |

## Architecture & Data Flow

All routers import `authenticateToken` from `../middleware/auth` (except `plg.api.ts` public endpoints). They query Mongoose models from `../models/` and delegate business logic to services in `../services/`. Rate limiting via `../middleware/rateLimiter` and `../middleware/merchant-rate-limiter`.

## Key Invariants

- Every query MUST filter by `req.merchant.merchantId` (IDOR prevention)
- Credentials in responses MUST be masked as `********`
- Plan-gated features use `requireFeature()` from `../middleware/planGating.middleware`
- CSV exports MUST sanitize for formula injection (DDE escaping)
- Password reset tokens: SHA-256 hashed, 15-min expiry, single-use

## Agent Cheat Sheet

- To add a new endpoint: Create `yourfeature.api.ts`, export default router, mount in `../index.ts` under `/api/yourfeature`
- To add plan gating: Wrap route with `requireFeature('feature_name')`
- To add rate limiting: Use `standardMerchantLimiter` for normal, `credentialValidationLimiter` for sensitive ops
