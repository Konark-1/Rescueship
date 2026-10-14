# tests/scripts/

> **Purpose**: Verification, load testing, simulated scenarios, and security probe scripts.  
> **Secret Scanning Policy**: All scripts in this directory must use dynamically generated runtime tokens or environment variables. No hardcoded credentials, test passwords, or simulated secrets are permitted.

## Active Script Catalog

| Script | Purpose | Usage | Status |
|--------|---------|-------| :--- |
| `verify-adversarial-fixes.ts` | Multi-vector adversarial security probe suite (Run in GitHub Actions CI) | `npx ts-node tests/scripts/verify-adversarial-fixes.ts` | **PASS** (12/12 probes passed) |

## Retired Ad-Hoc Scripts

All legacy manual runner scripts (`master-e2e-test.ts`, `run-50-irregular-live-tests.ts`, `execute-50-live-tests.ts`, `simulate-50-scenarios.ts`, `e2e-verification.ts`, `advanced-edge-cases-test.ts`, `test-2pm-vs-830pm.ts`, `test-infra.ts`, `load-test.js`, `simulate-all-possibilities.ts`, `test-shiprocket.ts`, `simulate_flow.ts`, `verify-phase5-identity-ops.ts`) have been retired to eliminate repository clutter and potential secret scan false positives. All test coverage is now executed via official Jest suites (`npm test`) and the CI adversarial probe.
- `simulate-all-possibilities.ts`
- `test-shiprocket.ts`
- `simulate_flow.ts`
- `verify-phase5-identity-ops.ts`

Their complete verification matrices, test cases, and architectural outcomes are permanently preserved in [`docs/TEST_SCRIPTS_VERIFICATION_REPORT.md`](../docs/TEST_SCRIPTS_VERIFICATION_REPORT.md).
