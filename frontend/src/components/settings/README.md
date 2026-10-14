# frontend/src/components/settings/

> **Purpose**: Merchant settings panel components — payment gateway credentials and WhatsApp template configuration.

## File Catalog

| Component | Role |
| :--- | :--- |
| `RazorpaySettings.tsx` | Razorpay Key ID/Secret form, automatic webhook endpoint configuration, and status indicator. |
| `CashfreeSettings.tsx` | Cashfree App ID/Secret form, v2023 webhook signature configuration, and live balance/connection checks. |
| `WhatsAppTemplates.tsx` | WhatsApp template catalog viewer, variable mapping inspector, and real-time smartphone preview. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `tests/payment-gateways.test.ts` | Jest | `PASS` ✅ | Razorpay and Cashfree gateway encryption and credentials validation |
| `tests/whatsapp-templates.test.ts` | Jest | `PASS` ✅ | Meta utility template parameter validation and language fallback |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Settings page route smoke, input masking, and credential update forms |
