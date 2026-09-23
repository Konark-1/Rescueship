# scripts/

> **Purpose**: CLI scripts — testing, seeding, deployment verification, load testing, and admin utilities.

## File Catalog

| File | Purpose | Usage |
|------|---------|-------|
| `grant-license.ts` | License activation (wrapper) | `npx ts-node scripts/grant-license.ts <email> [days]` |
| `simulate-flow.ts` | E2E simulation (wrapper) | `npx ts-node scripts/simulate-flow.ts` |
| `update-merchant-keys.ts` | Update Razorpay keys (wrapper) | `MERCHANT_ID=<id> npx ts-node scripts/update-merchant-keys.ts` |
| `seed-dev.ts` | Dev database seeder | `npx ts-node scripts/seed-dev.ts` |
| `list-merchants.ts` | List all merchants | `npx ts-node scripts/list-merchants.ts` |
| `link-all.ts` | Bulk carrier linking | `npx ts-node scripts/link-all.ts` |
| `test-shiprocket.ts` | Shiprocket API test | `npx ts-node scripts/test-shiprocket.ts` |
| `test-infra.ts` | MongoDB/Redis health | `npx ts-node scripts/test-infra.ts` |
| `tunnel.js` | Dev webhook tunnel | `node scripts/tunnel.js` (localtunnel :3000) |
| `load-test.js` | k6 stress test | `k6 run scripts/load-test.js` |
| `get-gmail-token.js` | Gmail OAuth2 token | `node scripts/get-gmail-token.js` |
| `generate-design-md.cjs` | Design token extractor | `npm run generate:design` |
| `simulate-all-possibilities.ts` | Exhaustive NDR simulation | `npx ts-node scripts/simulate-all-possibilities.ts` |
| `master-e2e-test.ts` | Full lifecycle E2E | `npx ts-node scripts/master-e2e-test.ts` |
| `e2e-verification.ts` | Platform verification | `npx ts-node scripts/e2e-verification.ts` |
| `advanced-edge-cases-test.ts` | Edge case validation | `npx ts-node scripts/advanced-edge-cases-test.ts` |
| `verify-adversarial-fixes.ts` | Security test suite | `npx ts-node scripts/verify-adversarial-fixes.ts` |
| `verify-phase5-identity-ops.ts` | Phase 5 audit | `npx ts-node scripts/verify-phase5-identity-ops.ts` |

## Key Invariants

- Scripts connect directly to MongoDB — use only in dev or with explicit admin intent
- `load-test.js` requires k6 binary installed separately
- `get-gmail-token.js` is interactive (requires browser consent)
- `tunnel.js` creates a PUBLIC URL — use only for webhook testing
