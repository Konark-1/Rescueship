# 🚢 RescueShip — Frontend Merchant Console

> **Purpose**: High-converting React 19 Single Page Application (SPA) powered by Vite 6 and TypeScript 5, delivering real-time NDR monitoring, autonomous WhatsApp recovery management, and multi-carrier logistics onboarding.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: React 19 + Vite 6 + TypeScript 5
- **Styling**: Theme-locked Dark Surface CSS Design Tokens, BEM methodology, zero runtime CSS-in-JS overhead
- **Motion & Physics**: Motion for React (`motion/react` v12) with spring physics and strict `prefers-reduced-motion` compliance
- **Icons**: Lucide React (`lucide-react`)
- **Visualizations**: Recharts v2 for RTO analytics, recovery conversion rates, and carrier delivery trends
- **Real-Time Engine**: Server-Sent Events (SSE) via `useRealtime` hook for live order state updates
- **Testing**: Playwright test suite (5 suites, 90 passing tests across Desktop Chromium and Mobile Chrome)

---

## 🗺️ Application Routes & Page Catalog

| Route | Page Component | Description |
| :--- | :--- | :--- |
| `/` | `LandingPage.tsx` | High-converting PLG landing page: boot sequence, scroll story, AI decoder, carrier marquee, and ROI calculator. |
| `/login` | `LoginPage.tsx` | Merchant authentication via email/password and Google OAuth 2.0. |
| `/register` | `RegisterPage.tsx` | Merchant onboarding registration with e-commerce platform selection. |
| `/onboarding` | `OnboardingPage.tsx` | 4-Station interactive setup wizard: Store, WhatsApp, Carrier Hub, and Payment. |
| `/dashboard` | `DashboardPage.tsx` | Real-time mission control: live SSE order stream, recovery metrics, and courier performance. |
| `/orders` | `OrdersPage.tsx` | Order ledger: multi-carrier search, status filters, and interactive NDR resolution modal. |
| `/sandbox` | `SandboxPage.tsx` | Interactive test environment: simulate carrier NDRs, test WhatsApp customer flows, and pass graduation gate. |
| `/settings` | `SettingsPage.tsx` | Credentials vault, multi-carrier hub, webhook endpoints, and single-select COD conversion incentive rules (none, flat, percentage with rupee margin cap). |
| `/templates` | `TemplatesPage.tsx` | Recovery Flows & Customer Experience Hub: Tab 1 (Turnkey Playbooks & Flow Simulator with dynamic pricing), Tab 2 (Real Customer Chat Audit & Dispute Resolution with 1-click UTR reconciliation). |
| `/billing` | `BillingPage.tsx` | SaaS tier selection (Starter, Growth, Scale), usage meters, and Razorpay checkout. |
| `/audit-logs` | `AuditLogsPage.tsx` | SOC-2 compliant immutable audit trail viewer with formatted JSON event inspector. |
| `/docs` | `DocsPage.tsx` | Interactive developer documentation: cURL, Node.js, and Python webhook code samples. |

---

## 🚚 Station 3: Multi-Carrier Logistics Integration Hub

The onboarding wizard's **Station 3 (`CarrierForm`)** provides a resilient multi-carrier configuration workflow:

### 1. Interactive Multi-Carrier Selection Grid
Merchants can select any combination of top logistics providers simultaneously:
- **Shiprocket**
- **Delhivery**
- **Blue Dart Express (DHL)**
- **Xpressbees**
- **Shadowfax**
- **Ecom Express**
- **DTDC**
- **ClickPost**
- **Custom / Aggregator** (supports NimbusPost, Shipway, Shyplite, India Post, and private fleets)

### 2. Sub-Tab Configuration Architecture
- Once carriers are selected, the UI dynamically renders independent sub-tabs.
- Merchants can switch between carriers to enter credentials or configure webhooks without losing progress or overwriting other integrations.
- Each carrier card features a status badge (`Connected`, `Ready to Connect`, `Webhook Only`).

### 3. Dual Integration Modes
For every carrier, merchants can toggle between two operating modes:
- **⚡ Direct API Integration**:
  - Connects using carrier credentials (API Key, Secret / Password, and Client / Account ID).
  - Displays context-sensitive hint boxes showing exactly where in that carrier's portal (e.g. Shiprocket API settings, Delhivery Unified Client Portal) to locate credentials.
  - Automatically dispatches reattempt schedules, address modifications, and RTO arrest calls directly to the carrier's API.
- **🔗 Webhook-Only Mode**:
  - **Zero API credentials required**.
  - Provides a merchant-specific, copyable webhook URL:
    `https://rescueship.onrender.com/webhooks/{carrier}/ndr?merchant_id={merchantId}`
  - Features 1-click clipboard copy with visual confirmation.
  - Ingests delivery failure webhooks, fires customer WhatsApp rescue workflows, and tracks recovery without needing API write access.

### 4. Custom Courier & Private Fleets
- Allows typing a custom carrier name (e.g., "NimbusPost", "Private Fleet North").
- Provides a universal NDR webhook endpoint (`/webhooks/custom/ndr?merchant_id=...`).
- Handles unstructured failure payloads with fallback heuristics.

---

## 🛠️ Development & Build Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local Vite development server
npm run dev

# 3. Type-check with TypeScript
npx tsc -b

# 4. Production build
npm run build

# 5. Preview production build locally
npm run preview
```

---

## 🔒 Security & Best Practices

- **Zero Credential Exposure**: Sensitive keys and tokens entered in the UI are transmitted securely over TLS and masked as `********` in all subsequent API responses.
- **Tenant Isolation**: All API calls made via `src/services/api.ts` automatically attach the merchant's JWT bearer token, ensuring queries remain strictly scoped to the tenant.
- **Accessible Motion**: All animations respect `prefers-reduced-motion: reduce` settings.
