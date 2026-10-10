# tests/scripts/

> **Purpose**: Verification, load testing, simulated scenarios, and security probe scripts.

## Script Catalog

| Script | Purpose | Usage |
|--------|---------|-------|
| `verify-adversarial-fixes.ts` | Multi-vector adversarial security probe suite | `npx ts-node tests/scripts/verify-adversarial-fixes.ts` |
| `master-e2e-test.ts` | End-to-end full platform lifecycle validation | `npx ts-node tests/scripts/master-e2e-test.ts` |
| `simulate-all-possibilities.ts` | Exhaustive NDR possibility matrix simulation | `npx ts-node tests/scripts/simulate-all-possibilities.ts` |
| `run-50-irregular-live-tests.ts` | 50 irregular scenarios live verification | `npx ts-node tests/scripts/run-50-irregular-live-tests.ts` |
| `e2e-verification.ts` | Multi-carrier integration verification | `npx ts-node tests/scripts/e2e-verification.ts` |
| `advanced-edge-cases-test.ts` | Edge cases and boundary testing | `npx ts-node tests/scripts/advanced-edge-cases-test.ts` |
| `verify-phase5-identity-ops.ts` | Phase 5 identity and ops verification | `npx ts-node tests/scripts/verify-phase5-identity-ops.ts` |
| `execute-50-live-tests.ts` | Live execution runner for 50 test cases | `npx ts-node tests/scripts/execute-50-live-tests.ts` |
| `simulate-50-scenarios.ts` | 50 scenarios simulator | `npx ts-node tests/scripts/simulate-50-scenarios.ts` |
| `simulate_flow.ts` | Interactive flow simulation | `npx ts-node tests/scripts/simulate_flow.ts` |
| `test-2pm-vs-830pm.ts` | Timing and delivery window differential test | `npx ts-node tests/scripts/test-2pm-vs-830pm.ts` |
| `test-infra.ts` | MongoDB and Redis infrastructure connectivity | `npx ts-node tests/scripts/test-infra.ts` |
| `test-shiprocket.ts` | Shiprocket API sandbox probe | `npx ts-node tests/scripts/test-shiprocket.ts` |
| `load-test.js` | k6 load test script | `k6 run tests/scripts/load-test.js` |
