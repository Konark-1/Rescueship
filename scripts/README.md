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
| `check-connections.ts` | Read-only live check of a merchant's Shopify / WhatsApp / gateway / courier credentials | `npm run check:connections -- <email> [--save]` |
| `setup.ts` | Interactive setup script for initial merchant onboarding | `npx ts-node scripts/setup.ts` |
| `smoke-deploy.ts` | Post-deploy smoke test checking /health, auth, and webhook routes | `npx ts-node scripts/smoke-deploy.ts` |
| `submit-templates.ts` | Batch submit Meta WhatsApp templates for approval | `npx ts-node scripts/submit-templates.ts` |

## Note on Test Scripts
Ad-hoc test scripts and scratch files have been removed from `scripts/` and consolidated into official Jest unit test suites (`tests/`) and the CI adversarial probe runner (`tests/scripts/verify-adversarial-fixes.ts`).

## Key Invariants
- Scripts connect directly to MongoDB/Redis — use only in dev or with explicit admin intent
- Production services and controllers import business logic from `src/services/`

