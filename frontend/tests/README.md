# tests/

> **Purpose**: Playwright E2E tests — comprehensive page, interaction, and accessibility testing.

## File Catalog

| File | Lines | Scope |
|------|-------|-------|
| `all-pages.spec.ts` | 863 | Full app smoke: public routes, auth, dashboard, orders, settings, templates, billing, audit, docs, sandbox, onboarding + WCAG 2.1 AA accessibility scans |
| `landing-plg.spec.ts` | 110 | Landing accessibility, visual regression, hero, PLG email capture |
| `onboarding.spec.ts` | 27 | Onboarding wizard layout, stepper heading, progress bar |
| `whatsapp-rescue.spec.ts` | 62 | Customer response branches: home confirmation, discount, GPS pin |

## Key Invariants

- Run with: `npm run test:e2e` (or `npx playwright test`)
- Config: `frontend/playwright.config.ts`
- Accessibility: `@axe-core/playwright` (WCAG 2.1 AA)
- Results: `test-results/`, Reports: `playwright-report/`

## Agent Cheat Sheet

- To add test: Create `your-feature.spec.ts`
- Single test: `npx playwright test tests/your-feature.spec.ts`
- Update snapshots: `npx playwright test --update-snapshots`
