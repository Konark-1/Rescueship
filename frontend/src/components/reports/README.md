# frontend/src/components/reports/

> **Purpose**: Enterprise reporting and fraud detection components — Carrier Fraud Watchtower and AI Rescue Funnel visualizations.

## File Catalog

| Component | Role |
| :--- | :--- |
| `FraudWatchtower.tsx` | Carrier fraud detection dashboard: flags fake remarks ("Customer not available" in <2 mins), geo-variance mismatches, and driver misconduct scores. |
| `RescueFunnel.tsx` | Step-by-step funnel visualization tracking NDR detected → WhatsApp sent → Customer replied → Rescheduled / Converted → Delivered. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/reports-enterprise.spec.ts` | Playwright | `PASS` ✅ | Watchtower fake attempt flags, rescue funnel conversion step tracking, geo-pincode sync |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Enterprise reports route smoke and accessibility testing |
