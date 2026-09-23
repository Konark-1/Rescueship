# .github/workflows/

> **Purpose**: GitHub Actions CI/CD pipelines — automated testing, security auditing, and Playwright E2E.

## File Catalog

| File | Trigger | What It Does |
|------|---------|-------------|
| `ci.yml` | PR to main/master/develop | Matrix build (Node 18.x, 20.x): `tsc --noEmit`, `npm test`, frontend `npm run build` |
| `playwright.yml` | PR to main/master/develop | Installs Playwright browsers, runs `npm run test:e2e` |
| `security.yml` | PR to main/master/develop | `npm audit`, dependency vulnerability scanning |

## Key Invariants

- ALL PRs must pass CI before merge
- Backend tested on both Node 18.x and 20.x
- Playwright tests require `npx playwright install --with-deps`
- Security workflow blocks PRs with critical vulnerabilities
