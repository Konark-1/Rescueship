# frontend/src/config/

> **Purpose**: Frontend application configuration definitions — pricing matrices, order volume bands, and billing formulas synchronized with the backend.

## File Catalog

| File | Role |
|------|------|
| `pricing.config.ts` | Single source of truth for RescueShip subscription pricing: Plan matrix (`rescue`, `convert`, `prevent`), Order volume bands (500 to 10,000 orders/mo), billing cycles (quarterly, semi, annual), and ROI savings calculation formulas. |

## Key Invariants

- Frontend `PRICE` matrix MUST strictly match backend `src/services/subscription.service.ts` and `src/config/plans.ts`.
- Any pricing drift will be immediately caught by the automated test suite.

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `tests/pricing-consistency.test.ts` | Jest | `PASS` ✅ | Mathematical parity between frontend `pricing.config.ts` and backend `plans.ts` / `subscription.service.ts` |
| `frontend/tests/checkout-flow.spec.ts` | Playwright | `PASS` ✅ | Plan selection, tier switching, and dynamic order volume calculation in UI |
