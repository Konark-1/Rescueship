# tests/scripts/

> **Purpose**: Verification, load testing, simulated scenarios, and security probe scripts.  
> **Secret Scanning Policy**: All scripts in this directory must use dynamically generated runtime tokens or environment variables. No hardcoded credentials, test passwords, or simulated secrets are permitted.

## Active Script Catalog

| Script | Purpose | Usage |
|--------|---------|-------|
| `verify-adversarial-fixes.ts` | Multi-vector adversarial security probe suite (Run in CI) | `npx ts-node tests/scripts/verify-adversarial-fixes.ts` |
| `master-e2e-test.ts` | End-to-end full platform lifecycle validation | `npx ts-node tests/scripts/master-e2e-test.ts` |
| `run-50-irregular-live-tests.ts` | 50 irregular scenarios live verification | `npx ts-node tests/scripts/run-50-irregular-live-tests.ts` |
| `execute-50-live-tests.ts` | Live execution runner for 50 test cases | `npx ts-node tests/scripts/execute-50-live-tests.ts` |
| `simulate-50-scenarios.ts` | 50 scenarios simulator using JSON dataset | `npx ts-node tests/scripts/simulate-50-scenarios.ts` |
| `e2e-verification.ts` | Multi-carrier integration verification | `npx ts-node tests/scripts/e2e-verification.ts` |
| `advanced-edge-cases-test.ts` | Edge cases and boundary testing | `npx ts-node tests/scripts/advanced-edge-cases-test.ts` |
| `test-2pm-vs-830pm.ts` | Timing and delivery window differential test | `npx ts-node tests/scripts/test-2pm-vs-830pm.ts` |
| `test-infra.ts` | MongoDB and Redis infrastructure connectivity probe | `npx ts-node tests/scripts/test-infra.ts` |
| `load-test.js` | k6 load test script for webhook ingestion | `k6 run tests/scripts/load-test.js` |

## Retired Scripts & Historical Documentation

The following integration scripts that previously contained simulated key strings or ad-hoc test passwords have been retired:
- `simulate-all-possibilities.ts`
- `test-shiprocket.ts`
- `simulate_flow.ts`
- `verify-phase5-identity-ops.ts`

Their complete verification matrices, test cases, and architectural outcomes are permanently preserved in [`docs/TEST_SCRIPTS_VERIFICATION_REPORT.md`](../docs/TEST_SCRIPTS_VERIFICATION_REPORT.md).
