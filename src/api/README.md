# api/

> **Purpose**: REST API route controllers — Express routers handling authenticated merchant requests and public endpoints.

## File Catalog

| File | Role | Key Endpoints |
|------|------|---------------|
| `ai.api.ts` | AI address decoder | `POST /decode-address`, `/geocode` |
| `analytics.api.ts` | Dashboard metrics | `GET /dashboard`, `GET /carriers` (Growth+ gated) |
| `auditlogs.api.ts` | Audit trail | `GET /` (paginated) |
| `auth.api.ts` | Authentication | `POST /register`, `/login`, `/google`, `/logout`, `/change-password`, `/forgot-password`, `/reset-password` |
| `billing.api.ts` | Subscriptions | `GET /usage`, `/plan`, `/status`, `POST /checkout`, `/checkout/verify` |
| `connect.api.ts` | Onboarding wizard | 20+ endpoints for Store/WhatsApp/Carrier/Payment integration |
| `dashboard.api.ts` | Dashboard API | `GET /summary`, `GET /action-queue`, `POST /action-queue/resolve` |
| `export.api.ts` | Data export | `GET /:type` (CSV/JSON, Scale+ gated) |
| `liveops.api.ts` | LiveOps telemetry | `GET /status`, `GET /dlq`, `POST /dlq/retry` (admin only) |
| `metrics.api.ts` | Performance | `GET /my`, `GET /cohort` (admin only) |
| `orders.api.ts` | Order management & dispute resolution | `GET /`, `GET /:id`, `GET /export/csv`, `GET /chats/recent`, `POST /:orderId/resend-payment-link`, `POST /:orderId/reconcile-utr` |
| `plg.api.ts` | PLG self-serve | `POST /signup`, `GET /validate-token`, `POST /activate` (public) |
| `realtime.api.ts` | SSE streaming | `GET /stream` (10-min cap), `GET /status` |
| `sandbox.api.ts` | Test environment | `POST /simulate-ndr`, `/toggle`, `/graduate` |
| `settings.api.ts` | Configuration | `GET /`, `PUT /` (single-select COD incentive strategy with rupee cap), `POST /custom-api-secret/rotate` |
| `templates.api.ts` | WhatsApp recovery playbooks | CRUD, `POST /:id/submit`, `POST /sync-meta`, `POST /test-send` |
| `transactions.api.ts` | Payment & settlement ledger | `GET /` (paginated, search, status filter), `GET /summary` (aggregate metrics) |

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

## Verified Tests & Status

| Test Suite | Tests Covered | Status |
| :--- | :--- | :--- |
| `auth.api.test.ts` | Merchant registration, login, Google OAuth, password reset, token revocation | **PASS** (10/10 passed) |
| `auth-and-access.test.ts` | JWT auth middleware, role-based access control, merchant token checks | **PASS** (8/8 passed) |
| `dashboard-attention.test.ts` | "Needs your attention" panel, broken connection surfacing, self-healing | **PASS** (6/6 passed) |
| `dashboard-and-risk-actions.test.ts` | Action queue triage, SLA timers, bulk resolve | **PASS** (12/12 passed) |
| `high-risk-pincodes.api.test.ts` | Pincode blacklisting/whitelisting API, dynamic risk rules | **PASS** (5/5 passed) |
| `health.api.test.ts` | Container /health and /live probes, dependency readiness | **PASS** (4/4 passed) |
| `subscription-lifecycle.test.ts` | SaaS billing plans, auto-debit, cycle renewal, quota enforcement | **PASS** (7/7 passed) |
| `subscription-no-trial.test.ts` | Pay-first flow, 90-day money-back guarantee, upfront billing | **PASS** (6/6 passed) |
| `pricing-consistency.test.ts` | Band-based tier pricing, order volume fee calculations | **PASS** (8/8 passed) |
| `setup-status.test.ts` | Merchant setup checklist, wizard progression state | **PASS** (6/6 passed) |

## Agent Cheat Sheet

- To add a new endpoint: Create `yourfeature.api.ts`, export default router, mount in `../index.ts` under `/api/yourfeature`
- To add plan gating: Wrap route with `requireFeature('feature_name')`
- To add rate limiting: Use `standardMerchantLimiter` for normal, `credentialValidationLimiter` for sensitive ops
