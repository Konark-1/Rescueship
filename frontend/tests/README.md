# tests/

> **Purpose**: Playwright E2E tests — comprehensive page, interaction, and accessibility testing.

## File Catalog

| File | Lines | Scope |
|------|-------|-------|
| `realtime-state.test.ts` | 134 | Vitest unit tests: Zustand store, optimistic state updates, stream events |
| `all-pages.spec.ts` | 863 | Full app smoke: public routes, auth, dashboard, orders, settings, templates, billing, audit, docs, sandbox, onboarding + WCAG 2.1 AA accessibility scans |
| `accessibility.spec.ts` | 85 | Motion accessibility, prefers-reduced-motion, keyboard navigation |
| `landing-plg.spec.ts` | 110 | Landing accessibility, visual regression, hero, PLG email capture |
| `landing-v2.spec.ts` | 240 | Landing v2 specs: hero, pricing, FAQs, order board geometry |
| `onboarding.spec.ts` | 27 | Onboarding wizard layout, stepper heading, progress bar |
| `reports-enterprise.spec.ts` | 225 | Carrier fraud watchtower, AI rescue funnel, high-risk pincodes sync |
| `whatsapp-rescue.spec.ts` | 62 | Customer response branches: home confirmation, discount, GPS pin |
| `whatsapp-simulator.spec.ts` | 55 | NDR sandbox simulator and fake remark interception |
| `checkout-flow.spec.ts` | 75 | Checkout & conversion flow tests |
| `dashboard-analytics.spec.ts` | 90 | Dashboard metrics, charts, date filters |
| `anti-exploitation-flow.spec.ts` | 80 | Customer abuse & anti-farming protection |

## Key Invariants

- Run with: `npm run test:e2e` (or `npx playwright test`)
- Config: `frontend/playwright.config.ts`
- Accessibility: `@axe-core/playwright` (WCAG 2.1 AA)
- Results: `test-results/`, Reports: `playwright-report/`

## Agent Cheat Sheet

- To add test: Create `your-feature.spec.ts`
- Single test: `npx playwright test tests/your-feature.spec.ts`
- Update snapshots: `npx playwright test --update-snapshots`
