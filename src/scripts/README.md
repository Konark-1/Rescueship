# scripts/

> **Purpose**: Internal database maintenance and admin CLI scripts.

## File Catalog

| File | Role | Usage |
|------|------|-------|
| `grant-license.ts` | License activation | `npx ts-node src/scripts/grant-license.ts <merchantIdOrEmail> [days=90]` |
| `simulate_flow.ts` | E2E simulation | `npx ts-node src/scripts/simulate_flow.ts` — registers merchant, fires webhook, queries results |
| `updateMerchantKeys.ts` | Update Razorpay keys | `MERCHANT_ID=<id> RZP_TEST_KEY_ID=... ts-node src/scripts/updateMerchantKeys.ts` |

## Key Invariants

- These scripts connect directly to MongoDB — run only in dev or with explicit admin intent
- Root-level `../../scripts/` provides wrapper entrypoints for these scripts
- `grant-license.ts` sets `licenseStatus: 'ACTIVE'`, `billing.status: 'active'`, minimum 500 rescue credits
