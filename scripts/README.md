# scripts/

> **Purpose**: Operational CLI utilities — administrative maintenance, merchant management, database seeding, and live monitoring.

## File Catalog

| File | Purpose | Usage |
|------|---------|-------|
| `seed-dev.ts` | Dev database seeder | `npx ts-node scripts/seed-dev.ts` |
| `list-merchants.ts` | List all merchants | `npx ts-node scripts/list-merchants.ts` |
| `link-all.ts` | Bulk carrier linking | `npx ts-node scripts/link-all.ts` |
| `send-test-email.ts` | Test email dispatch | `npx ts-node scripts/send-test-email.ts` |
| `grant-license.ts` | Grant/extend merchant license | `npx ts-node scripts/grant-license.ts <email> [days]` |
| `updateMerchantKeys.ts` | Update merchant encryption keys | `npx ts-node scripts/updateMerchantKeys.ts` |
| `backfill-pincodes.ts` | Idempotent pincode backfill | `npx ts-node scripts/backfill-pincodes.ts [--dry-run]` |
| `liveops-watchtower.ts` | LiveOps telemetry & watchtower checks | `npx ts-node scripts/liveops-watchtower.ts [dlq\|waba\|webhooks\|all]` |
| `tunnel.js` | Dev webhook tunnel | `node scripts/tunnel.js` (localtunnel :3000) |
| `generate-design-md.cjs` | Design token extractor | `node scripts/generate-design-md.cjs` |

## Note on Test Scripts
All test runners, simulated flow verification scripts, and adversarial probes have been cleanly separated into [`tests/scripts/`](../tests/scripts/):
- `tests/scripts/verify-adversarial-fixes.ts`
- `tests/scripts/master-e2e-test.ts`
- `tests/scripts/simulate-all-possibilities.ts`
- `tests/scripts/run-50-irregular-live-tests.ts`
- `tests/scripts/e2e-verification.ts`
- `tests/scripts/advanced-edge-cases-test.ts`
- `tests/scripts/verify-phase5-identity-ops.ts`
- `tests/scripts/execute-50-live-tests.ts`
- `tests/scripts/simulate-50-scenarios.ts`
- `tests/scripts/simulate_flow.ts`
- `tests/scripts/test-2pm-vs-830pm.ts`
- `tests/scripts/test-infra.ts`
- `tests/scripts/test-shiprocket.ts`
- `tests/scripts/load-test.js`

## Key Invariants
- Scripts connect directly to MongoDB/Redis — use only in dev or with explicit admin intent
- Production services and controllers import business logic from `src/services/`
