# frontend/src/legal/

> **Purpose**: Single source of truth for RescueShip legal entity data, business registration metadata, customer dispute jurisdiction, and compliance guarantees.

## File Catalog

| File | Role |
|------|------|
| `entity.ts` | Exports `LEGAL` constant and `legalEntityLine()` helper used across Terms of Service, Privacy Policy, DPDP Addendum, and invoice footers. |

## Key Invariants

- Legal details must remain strictly aligned with business verification submissions for Meta, Razorpay, and Shopify.
- Contact email is bound to `konarkofficial@gmail.com`.

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Verifies legal route rendering (`/privacy`, `/terms`, `/dpa`) and accessibility compliance |
