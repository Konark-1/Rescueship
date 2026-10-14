# frontend/src/components/onboarding/

> **Purpose**: 4-Station interactive onboarding wizard components — store sync, WhatsApp Cloud setup, multi-carrier hub, and payment gateway configuration.

## File Catalog

| Component | Role |
| :--- | :--- |
| `StoreStation.tsx` | Station 1: E-commerce platform connection (Shopify 1-click OAuth or WooCommerce API keys). |
| `WhatsAppStation.tsx` | Station 2: Meta WhatsApp Cloud API integration with System User token validator. |
| `CourierStation.tsx` | Station 3: Multi-carrier logistics hub (8 couriers + custom, Direct API & Webhook-only modes). |
| `PaymentStation.tsx` | Station 4: Razorpay & Cashfree gateway configuration for instant COD conversion incentives. |
| `TestRescuePanel.tsx` | Interactive pre-launch verification sandbox to trigger a sample rescue message. |
| `Field.tsx` | Accessible form field primitive with floating labels, error badges, and contextual help tooltips. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/onboarding.spec.ts` | Playwright | `PASS` ✅ | 4-Station wizard step navigation, form validation, progress bar state |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Onboarding route access control and WCAG accessibility standards |
