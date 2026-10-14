# pages/

> **Purpose**: Top-level page views — lazy-loaded route targets for authentication, dashboard, order management, onboarding, enterprise reporting, and legal compliance.

## File Catalog

| File | Route | Purpose |
|------|-------|---------|
| `LandingPage.tsx` | `/` | Conversion landing: hero, ROI calculator, plan picker, FAQ, trust badges |
| `LoginPage.tsx` | `/login` | Email/password login + Google OAuth |
| `RegisterPage.tsx` | `/register` | Merchant registration |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Password reset request |
| `ResetPasswordPage.tsx` | `/reset-password` | Password reset confirmation with token |
| `VerifyEmailPage.tsx` | `/verify-email` | Email verification confirmation |
| `DashboardPage.tsx` | `/dashboard` | Command center: live metric counters, urgent action queue, resolution feed |
| `OrdersPage.tsx` | `/orders` | Order management: search, filters, timeline modal, address edit |
| `OnboardingPage.tsx` | `/onboarding` | 4-station wizard: Store, WhatsApp, Multi-Carrier Hub, Payment |
| `ReportsPage.tsx` | `/reports` | Enterprise reporting: Carrier Fraud Watchtower, AI Rescue Funnel, high-risk pincodes |
| `ConnectedApisPage.tsx` | `/connected-apis` (`/docs` redirect) | API integration credentials, webhook signing secrets, cURL samples |
| `SandboxPage.tsx` | `/sandbox` | Interactive NDR sandbox simulator, fake remark testing, WABA quality monitoring |
| `SettingsPage.tsx` | `/settings` | Platform/carrier/WhatsApp/payment credential management |
| `TemplatesPage.tsx` | `/templates` | Meta WhatsApp template registry + real-time mobile preview |
| `BillingPage.tsx` | `/billing` | Plan selection, India-market feature ladders, Razorpay checkout |
| `AuditLogsPage.tsx` | `/audit-logs` | SOC-2 immutable audit trail viewer + raw JSON inspector |
| `ShopifyLaunchPage.tsx` | `/shopify` | Shopify App Store launch & OAuth installation bridge |
| `PrivacyPolicy.tsx` | `/privacy` | Privacy policy compliance page |
| `TermsOfService.tsx` | `/terms` | Merchant terms of service |
| `DPDPAddendum.tsx` | `/dpa` | Digital Personal Data Protection (DPDP) Act legal addendum |

Associated CSS: `landing.css`, `auth.css`, `onboarding.css`, `sandbox.css`, `billing.css`, `legal.css`, `TemplatesPage.css`

## Key Invariants

- ALL pages lazy-loaded via `React.lazy()` in `App.tsx`
- Protected pages require `useAuth().isAuthenticated`
- `DashboardLayoutWrapper` gates access unless merchant completed onboarding
- `DashboardPage` uses `useRealtime()` hook for live SSE stream events
- Data fetching uses `../services/api` with automatic JWT Bearer headers

## 🧪 Verified Tests & Status

| Test Suite | Scope | Status |
| :--- | :--- | :---: |
| `tests/all-pages.spec.ts` | End-to-end smoke across all page routes: Landing, Auth, Dashboard, Orders, Settings, Templates, Billing, Reports, Sandbox, Onboarding | `PASS` ✅ |
| `tests/landing-plg.spec.ts` | Landing page PLG funnel, email capture modal, ROI interactive calculator | `PASS` ✅ |
| `tests/landing-v2.spec.ts` | Responsive layouts, pricing tier selectors, FAQ accordion | `PASS` ✅ |
| `tests/onboarding.spec.ts` | 4-Station onboarding wizard: Store, WhatsApp, Multi-Carrier Hub, Payment | `PASS` ✅ |
| `tests/reports-enterprise.spec.ts` | Enterprise reports: Fraud Watchtower, AI Funnel, pincode sync | `PASS` ✅ |
| `tests/checkout-flow.spec.ts` | Billing checkout & Razorpay checkout integration | `PASS` ✅ |
| `tests/accessibility.spec.ts` | WCAG 2.1 AA accessibility checks across all page views | `PASS` ✅ |

