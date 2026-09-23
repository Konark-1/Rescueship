# pages/

> **Purpose**: Application page route components — 14 lazy-loaded pages for the merchant console.

## File Catalog

| File | Route | Role |
|------|-------|------|
| `LandingPage.tsx` | `/` | PLG landing: boot sequence, scroll story, AI decoder, carrier marquee, lead capture |
| `LoginPage.tsx` | `/login` | Email/password + Google OAuth sign-in |
| `RegisterPage.tsx` | `/register` | Merchant registration with platform selection |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Password reset email request |
| `ResetPasswordPage.tsx` | `/reset-password` | Token-based password reset confirmation |
| `DashboardPage.tsx` | `/dashboard` | Real-time telemetry with SSE, Recharts, AnimatedCounters |
| `OrdersPage.tsx` | `/orders` | Order management: search, filters, timeline modal |
| `OnboardingPage.tsx` | `/onboarding` | 4-station wizard: Store, WhatsApp, Carrier, Payment |
| `SandboxPage.tsx` | `/sandbox` | NDR simulation, WABA quality monitoring |
| `SettingsPage.tsx` | `/settings` | Platform/carrier/WhatsApp/payment credential management |
| `TemplatesPage.tsx` | `/templates` | Meta WhatsApp template registry + mobile preview |
| `BillingPage.tsx` | `/billing` | Plan selection, ROI calculator, Razorpay checkout |
| `AuditLogsPage.tsx` | `/audit-logs` | SOC-2 audit trail viewer + JSON inspector |
| `DocsPage.tsx` | `/docs` | Interactive API docs: cURL/Node/Python examples |

Associated CSS: `landing.css`, `auth.css`, `onboarding.css`, `sandbox.css`, `billing.css`

## Key Invariants

- ALL pages lazy-loaded via `React.lazy()` in `App.tsx`
- Protected pages require `useAuth().isAuthenticated`
- `OnboardingPage` renders only when `user.onboardingStatus === 'pending'`
- `DashboardPage` uses `useRealtime()` hook for live SSE updates
- Data fetching uses `../services/api` (auto auth headers)

## Agent Cheat Sheet

- To add a new page: Create `YourPage.tsx`, lazy-import in `App.tsx`, add `<Route>`
- To add to sidebar: Add entry in `../components/AppLayout.tsx` navigation sections
