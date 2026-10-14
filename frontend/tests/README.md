# tests/

> **Purpose**: Playwright E2E tests — comprehensive page, interaction, and accessibility testing.

## File Catalog & Verified Test Status

| File | Lines | Scope | Status |
|------|-------|-------|:------:|
| `sla-and-bucketing.test.ts` | 110 | Vitest unit tests: Smart Action Queue 24/48h SLA clocks, urgency bucketing, pre-dispatch alerts (9 tests) | `PASS` ✅ |
| `realtime-state.test.ts` | 134 | Vitest unit tests: Zustand store, optimistic state updates, stream events (11 tests) | `PASS` ✅ |
| `all-pages.spec.ts` | 863 | Full app smoke: public routes, auth, dashboard, orders, settings, templates, billing, audit, docs, sandbox, onboarding + WCAG 2.1 AA accessibility scans | `PASS` ✅ |
| `accessibility.spec.ts` | 85 | Motion accessibility, prefers-reduced-motion, keyboard navigation (6 tests) | `PASS` ✅ |
| `landing-plg.spec.ts` | 110 | Landing accessibility, visual regression, hero, PLG email capture (8 tests) | `PASS` ✅ |
| `landing-v2.spec.ts` | 240 | Landing v2 specs: hero, pricing, FAQs, order board geometry (12 tests) | `PASS` ✅ |
| `onboarding.spec.ts` | 27 | Onboarding wizard layout, stepper heading, progress bar (4 tests) | `PASS` ✅ |
| `reports-enterprise.spec.ts` | 225 | Carrier fraud watchtower, AI rescue funnel, high-risk pincodes sync (10 tests) | `PASS` ✅ |
| `whatsapp-rescue.spec.ts` | 62 | Customer response branches: home confirmation, discount, GPS pin (6 tests) | `PASS` ✅ |
| `whatsapp-simulator.spec.ts` | 55 | NDR sandbox simulator and fake remark interception (5 tests) | `PASS` ✅ |
| `checkout-flow.spec.ts` | 75 | Checkout & conversion flow tests (7 tests) | `PASS` ✅ |
| `dashboard-analytics.spec.ts` | 90 | Dashboard metrics, charts, date filters (6 tests) | `PASS` ✅ |
| `dashboard-phase2.spec.ts` | 205 | Data honesty, SLA timers, countdown banners, action queue accessibility | `PASS` ✅ |
| `anti-exploitation-flow.spec.ts` | 80 | Customer abuse & anti-farming protection (6 tests) | `PASS` ✅ |

## Key Invariants

- Run with: `npm run test:e2e` (or `npx playwright test`)
- Config: `frontend/playwright.config.ts`
- Accessibility: `@axe-core/playwright` (WCAG 2.1 AA)
- Results: `test-results/`, Reports: `playwright-report/`

## Agent Cheat Sheet

- To add test: Create `your-feature.spec.ts`
- Single test: `npx playwright test tests/your-feature.spec.ts`
- Update snapshots: `npx playwright test --update-snapshots`
