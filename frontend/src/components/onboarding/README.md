# frontend/src/components/onboarding/

> **Purpose**: 3-Station interactive onboarding wizard components — store sync, multi-carrier hub, and dual-mode payment gateway configuration (with Autonomous WhatsApp active out-of-the-box).

## File Catalog

| Component | Role |
| :--- | :--- |
| `StoreStation.tsx` | Station 1: E-commerce platform connection (Shopify 1-click OAuth or WooCommerce API keys). |
| `CourierStation.tsx` | Station 2: Multi-carrier logistics hub (8 couriers + custom, Direct API & Webhook-only modes). |
| `PaymentStation.tsx` | Station 3: Dual-mode payment setup — Simple Managed (Zero-KYC, UPI/Bank settlement, ~2.65% fee) or Advanced Direct (Own Razorpay/Cashfree API keys). |
| `WhatsAppStation.tsx` | Enterprise / Optional: Dedicated Meta WhatsApp Cloud API integration for custom merchant WABA & green ticks. (Platform-managed delivery desk is active by default). |
| `TestRescuePanel.tsx` | Interactive pre-launch verification sandbox to trigger a sample rescue message. |
| `Field.tsx` | Accessible form field primitive with floating labels, error badges, and contextual help tooltips. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/onboarding.spec.ts` | Playwright | `PASS` ✅ | 4-Station wizard step navigation, form validation, progress bar state |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Onboarding route access control and WCAG accessibility standards |
