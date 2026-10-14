# middleware/

> **Purpose**: Express middleware chain — authentication, HMAC verification, rate limiting, plan gating, request validation, and error handling.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `auth.ts` | JWT authentication | `authenticateToken`, `generateToken`, `AuthenticatedRequest` interface |
| `errorHandler.ts` | Global error handler | `AppError` class, `globalErrorHandler` |
| `merchant-rate-limiter.ts` | Per-merchant limits | `standardMerchantLimiter` (100/min), `exportMerchantLimiter` (5/min), `webhookMerchantLimiter` (500/min) |
| `planGating.middleware.ts` | Feature gating | `planLimits`, `requireFeature(featureName)` |
| `rateLimiter.ts` | Per-IP limits | `webhookLimiter` (1000/min), `apiLimiter` (100/min), `loginLimiter` (5/15min), `passwordResetLimiter` (5/15min) |
| `validateRequest.ts` | Zod validation | `validateBody(schema)`, `validateQuery(schema)`, `validateParams(schema)` |
| `webhookSignature.ts` | Basic HMAC | `verifyShopifyHmac(secret)`, `verifyRazorpaySignature(secret)` |
| `webhookVerify.ts` | Enterprise HMAC | `verifyShopifyHmac`, `verifyRazorpaySignature`, `verifyWhatsAppSignature`, `verifyWooCommerceSignature` |

## Key Invariants

- `authenticateToken` checks `tokenVersion` — password changes invalidate all sessions
- `merchant-rate-limiter` uses Redis atomic Lua scripts with in-memory fallback
- `webhookVerify.ts` uses `crypto.timingSafeEqual` — NEVER use `===` for signature comparison
- `planGating` checks server-authoritative plan tier, not client-claimed tier

## Verified Tests & Status

| Test Suite | Tests Covered | Status |
| :--- | :--- | :--- |
| `auth-and-access.test.ts` | JWT verification, token version invalidation on password change, tenant binding | **PASS** (8/8 passed) |
| `rate-limiting.test.ts` | Tiered IP/merchant rate limiters, burst defense | **PASS** (6/6 passed) |
| `security-vault.test.ts` | IDOR prevention, cross-tenant isolation, credential masking | **PASS** (7/7 passed) |
| `vulnerability-remediation.test.ts` | Input sanitization, NoSQL injection defenses, Prototype pollution guards | **PASS** (14/14 passed) |
| `merchant-separation.test.ts` | Strict multi-tenant data boundaries across queries and collections | **PASS** (16/16 passed) |
| `enterprise-vectors.test.ts` | Advanced adversarial threat vectors, replay attack defense | **PASS** (12/12 passed) |
| `red-team-hardening.test.ts` | Security audit recommendations, strict payload validation | **PASS** (11/11 passed) |

## Agent Cheat Sheet

- To protect a route: Add `authenticateToken` as first middleware
- To gate by plan: Add `requireFeature('feature_name')` after auth
- To add Zod schema validation: Define in `../schemas/`, use `validateBody(schema)`
- To add webhook HMAC for new provider: Add verify function in `webhookVerify.ts`
