# 🚢 RescueShip — Autonomous WhatsApp NDR Interception & RTO Recovery Engine

[![Production Frontend](https://img.shields.io/badge/Render-rescueship--frontend.onrender.com-46E3B7?style=flat&logo=render)](https://rescueship-frontend.onrender.com)
[![Production Backend](https://img.shields.io/badge/Render-rescueship.onrender.com-46E3B7?style=flat&logo=render)](https://rescueship.onrender.com)
[![Test Suite](https://img.shields.io/badge/Tests-415%20passed%20(49%20suites)-brightgreen?style=flat&logo=jest)](https://github.com/Konark-1/Rescueship)
[![Meta WhatsApp API](https://img.shields.io/badge/Meta_Cloud_API-v22.0-25D366?style=flat&logo=whatsapp)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=node.js)](https://nodejs.org/)

RescueShip is an enterprise-grade autonomous NDR (Non-Delivery Report) recovery and RTO (Return to Origin) reduction platform built for high-volume D2C e-commerce brands in India.

By intercepting courier non-delivery reports within **90 seconds** and executing category-deterministic, approved Meta WhatsApp utility workflows, RescueShip resolves doorstep friction, corrects addresses, converts cash-on-delivery orders to instant UPI, and locks verified reschedule dates directly into courier systems before return transit starts.

---

## 🌐 Live Production Deployments & Infrastructure

| Service | Environment | Endpoint | Details |
| :--- | :--- | :--- | :--- |
| **Frontend Web App (Primary)** | Render Static Site | [`https://rescueship-frontend.onrender.com`](https://rescueship-frontend.onrender.com) | React 19 SPA (Service ID: `srv-damhfof40ujc73av6hj0`) |
| **Frontend Web App (Alternative)** | Netlify CDN | [`https://rescueship.netlify.app`](https://rescueship.netlify.app) | Global Edge CDN fallback (Site ID: `50a5e507-c497-49b0-b441-7251fe527838`) |
| **Backend REST API** | Render Web Service | [`https://rescueship.onrender.com`](https://rescueship.onrender.com) | Express 5 + Node.js cluster (Service ID: `srv-dah653142hec73evd020`) |
| **Key-Value & Redis Queue** | Render Native Redis | Internal `redis://red-dah7i215efls738cbueg:6379` | Unmetered commands, 0 quota ceiling, private VPC |
| **Database** | MongoDB Atlas | AWS Mumbai Cluster (`cluster0.jkbuwf6.mongodb.net`) | M10+ replica set with primary-preferred read preference |
| **Active Keepalive** | Cron-Job.org | `https://rescueship.onrender.com/health` | Deep health probe every 5 mins (`{"status":"healthy","checks":{"mongodb":"ok","redis":"ok"}}`) |
| **Credentials Vault** | Private Vault | `CREDENTIALS.md` *(Outside Git)* | Live infrastructure secrets, tokens, and DB connection strings |

---

## ⚡ The D2C Logistics Problem in India

- **20% to 35% of all COD shipments end in RTO**: Couriers mark *"Customer Unavailable"*, *"Premises Locked"*, or *"Address Incomplete"* in under 4 minutes to hit quotas without attempting delivery or calling.
- **₹200–₹400 lost per RTO event**: D2C brands absorb forward shipping (₹80), reverse return shipping (₹80), inventory lock-in, repackaging/QC (₹40), and lost customer acquisition costs (CAC).
- **Manual Calling Fails**: Call centers take 4–6 hours to follow up on NDR sheets, by which time the package is already on an inter-city line-haul truck back to the warehouse.

---

## 🔁 The 90-Second Autonomous Rescue Architecture

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               Courier Logs Delivery Failure            │
                                    │ (Shiprocket / Delhivery / Blue Dart / Xpressbees /     │
                                    │  Shadowfax / Ecom Express / DTDC / ClickPost / Custom) │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │ Webhook (< 10s)
                                                                ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │                RescueShip Core Engine                  │
                                    │   • Webhook signature verification (HMAC SHA-256)      │
                                    │   • Anti-exploitation cooldown check (Anti-Farming)    │
                                    │   • Category classification & template resolution       │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │ Dispatch (< 60s)
                                                                ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │          Meta WhatsApp Cloud API (v22.0)               │
                                    │        Category-Deterministic Utility Template         │
                                    └───────┬───────────────────┬────────────────────┬───────┘
                                            │                   │                    │
                    ┌───────────────────────┴──────┐ ┌──────────┴────────┐ ┌─────────┴─────────────────────┐
                    │     1. Premises Locked       │ │ 2. Address Issue  │ │ 3. COD Friction / RTO Arrest  │
                    │      `ndr_reschedule_en`     │ │ `ndr_address_en`  │ │ `ndr_cod_convert_en` / `ret`  │
                    └──────────────┬───────────────┘ └──────────┬────────┘ └─────────┬─────────────────────┘
                                   │                            │                    │
                                   ▼                            ▼                    ▼
                    ┌──────────────────────────────┐ ┌───────────────────┐ ┌───────────────────────────────┐
                    │ • "I'm Home Now"             │ │ • Share GPS Pin   │ │ • Dynamic 1-click UPI Link    │
                    │   (Flags fake attempt)       │ │   (Reverse geocode│ │ • Self-funding 5% discount    │
                    │ • Reschedule:                │ │ • Type Landmark   │ │ • Shopify tag: Prepaid        │
                    │   - Tomorrow                 │ │   (Gemini NLP)    │ │ • Courier COD adjusted to ₹0  │
                    │   - Day After Tomorrow       │ │ • 2-Step floor/   │ │ • RTO transit halt locked on  │
                    │   - This Weekend             │ │   tower merge     │ │   payment capture webhook     │
                    └──────────────┬───────────────┘ └──────────┬────────┘ └─────────┬─────────────────────┘
                                   │                            │                    │
                                   └────────────────────┬───────┴────────────────────┘
                                                        │ Instant API Sync (< 90s total)
                                                        ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │                 Courier Partner Systems                │
                                    │    • Delhivery Waypoint & Next-day slot locked         │
                                    │    • Shiprocket Escalation API triggered               │
                                    │    • Blue Dart / Xpressbees / Shadowfax / Ecom / DTDC  │
                                    │      automated reattempts & address corrections synced │
                                    │    • Line-haul return transit halted in hub            │
                                    └────────────────────────────────────────────────────────┘
```

---

## 🚚 Multi-Carrier Logistics Hub & Supported Providers

RescueShip integrates out-of-the-box with India's top 8 logistics networks and aggregators, supporting unified NDR interception, automated reattempt scheduling, dynamic address corrections, and RTO arrest across all providers:

| Logistics Partner | Ingestion Webhook | Action Dispatching | Integration Modes |
| :--- | :--- | :--- | :--- |
| **Shiprocket** | `/webhooks/shiprocket/ndr` | Escalation API, Next-Day Reattempt, COD Adjustment | Direct API & Webhook-Only |
| **Delhivery** | `/webhooks/delhivery/ndr` | Waypoint Reattempt Slotting, Address Update API | Direct API & Webhook-Only |
| **Blue Dart Express (DHL)** | `/webhooks/bluedart/ndr` | Waybill Rescheduling, Consignee Remarks Sync | Direct API & Webhook-Only |
| **Xpressbees** | `/webhooks/xpressbees/ndr` | Real-Time Reattempt Dispatch, Street/Pin Rectification | Direct API & Webhook-Only |
| **Shadowfax** | `/webhooks/shadowfax/ndr` | Doorstep Slot Reschedule, RTO Cancellation Halt | Direct API & Webhook-Only |
| **Ecom Express** | `/webhooks/ecomexpress/ndr` | Field Remark Parsing, Reattempt Instruction Dispatch | Direct API & Webhook-Only |
| **DTDC** | `/webhooks/dtdc/ndr` | Consignment Tracking, Address Amendment Sync | Direct API & Webhook-Only |
| **ClickPost** | `/webhooks/clickpost/ndr` | Logistics Intelligence Parsing, Reattempt Dispatch | Direct API & Webhook-Only |
| **Custom / Aggregators** | `/webhooks/custom/ndr` | Universal Payload Ingestion (NimbusPost, Shipway, Shyplite, India Post, Private Fleets) | Webhook-Only & Universal API |

### Dual Integration Modes

Every carrier can be operated in one of two modes depending on merchant infrastructure:

1. **⚡ Direct API Integration**:
   - Merchants supply carrier credentials (API Key, Secret / Password, and Client / Account ID).
   - In-app setup guidance provides exact dashboard navigation paths for each carrier to retrieve credentials.
   - RescueShip automatically dispatches customer reschedule selections, corrected GPS addresses, and RTO arrest instructions directly into the carrier's operations portal in real-time.

2. **🔗 Webhook-Only Mode**:
   - **Zero API credentials required**.
   - Merchants simply copy their dedicated webhook URL:
     ```
     https://rescueship.onrender.com/webhooks/{provider}/ndr?merchant_id={merchantId}
     ```
   - The carrier or aggregator posts delivery failure events to this URL. RescueShip intercepts the failure, engages the buyer via WhatsApp, captures address corrections or UPI conversions, and updates the merchant dashboard—bypassing carrier API integration complexity.

### Multi-Select & Sub-Tab Onboarding (Station 3)

The onboarding wizard (`CarrierForm`) allows merchants to:
- **Multi-Select Carriers**: Select any combination of delivery partners simultaneously from an interactive grid.
- **Independent Configuration Sub-Tabs**: Configure each chosen carrier with dedicated credentials or webhook URLs without context loss.
- **Isolated Connection Management**: Test, connect, or disconnect individual carriers without overwriting or disrupting other active integrations.
- **Custom Courier Name Labeling**: Support custom or private courier fleets with merchant-defined labels and universal payload ingestion.

---

## 🛡️ Anti-Exploitation & Unit Economics Engine

RescueShip is built on strict logistics unit economics—**never** on free money handouts or unbacked marketing gimmicks:

### 1. Zero Fake Features
- **Eliminated Fake Air Upgrades**: Couriers in India do not offer mid-transit air-freight upgrades on ground surface shipments. Fake claims like *"Priority Air Express"* have been permanently eliminated.
- **Eliminated Free Coupon Handouts**: Uncalibrated win-back codes (such as `COMEBACK150`) that erode gross margins have been eradicated.

### 2. Self-Funding COD-to-Prepaid Retention
- When a customer attempts cancellation or hesitates due to lack of cash at doorstep, RescueShip offers a **5% retention discount** (capped at ₹100).
- **The Economic Math**: Indian logistics carriers charge **₹80 to ₹140 per parcel** as cash-handling and reconciliation fees for COD shipments. Converting an order to Prepaid eliminates this courier surcharge entirely. The 5% incentive is **100% self-funded** by the operational fee savings, preserving merchant gross margin.
- **Prepaid Orders Locked**: If an order was already paid online, zero discount is offered upon cancellation request—preventing opportunistic coupon fishing.

### 3. Anti-Farming Serial Cancellation Cooldown
- Repeat abusers who attempt to "game" retention offers by repeatedly placing and cancelling orders are tracked via phone number hashing.
- If a customer has **$\ge 3$ cancellations or RTOs in the past 30 days**, the retention engine bypasses all incentives and executes a clean, immediate cancellation.

### 4. Payment-Gated Transit Reversal
- In high-urgency Return-to-Origin (RTO) situations where parcels are sitting in sorting hubs, transit reversal is **strictly gated on a verified payment capture webhook** from Razorpay or Cashfree.
- Tapping a WhatsApp button alone does **not** halt transit; only a captured monetary transaction instructs the carrier's line-haul API to halt the reverse shipment.

### 5. Universal Order Ingestion & Phone Preservation (Shopify & WooCommerce)
- **Zero Order Drop Policy**: RescueShip does not ignore prepaid orders. Both COD and Prepaid orders across Shopify and WooCommerce are stored immediately upon store order creation (`status: 'new'`) with contact details normalized via `normalizeIndianPhone`.
- **The Missing Phone Problem in Carrier Webhooks Solved**: Major Indian couriers (Delhivery, ClickPost, Blue Dart) frequently omit consignee phone numbers in their NDR event payloads. If prepaid orders were skipped on store creation, subsequent courier failure webhooks would abort with `ndr_skipped_no_phone`. By ingesting prepaid orders upon creation, RescueShip links the incoming AWB to the stored order record, ensuring **100% of prepaid NDRs are rescued** via WhatsApp.
- **Quarantined Shipment Reconciliation**: Tracking numbers and AWBs detected in store order metadata or fulfillments automatically un-quarantine previously orphaned carrier shipments.

### 6. Courier Remark Sanitization for Prepaid Parcels
- Delivery executives frequently log erroneous remarks like *"Cash not ready"* or *"COD payment issue"* on parcels that were already prepaid online.
- RescueShip detects prepaid status and automatically sanitizes the failure category from `COD_COLLECTION_ISSUE` to `CUSTOMER_NOT_AVAILABLE`.
- This ensures prepaid buyers are never confused with COD payment links (`ndr_cod_convert_en`), receiving only the non-intrusive delivery reschedule template (`ndr_reschedule_en`).

### 7. Verified Attribution & Direct ROI Accounting
- Every rescued order (via rescheduling, address update, or RTO arrest) explicitly records prevented return freight losses (`order.rtoFeeSaved` and `NdrCase.estimatedLossPrevented`), computed directly from merchant parameters (default ₹140 per shipment: ₹70 forward + ₹70 reverse).
- Attributions feed the Sunday weekly WhatsApp ROI report and live merchant dashboard with zero speculative inflation.

---

## 📲 Approved Meta WhatsApp Utility Templates

All customer-facing WhatsApp interactions utilize pre-approved **UTILITY** templates under Meta Business Manager:

| Template Identifier | Category | Purpose | Customer Action Buttons |
| :--- | :---: | :--- | :--- |
| **`ndr_reschedule_en`** | UTILITY | Intercepts "Customer Unavailable" and "Premises Locked" remarks. | `I'm Home Now`, `Reschedule`, `Cancel Order` |
| **`ndr_address_en`** | UTILITY | Disambiguates missing house numbers, landmarks, and street pins. | `Share GPS Pin`, `Type Landmark`, `Cancel Order` |
| **`ndr_cod_convert_en`** | UTILITY | Doorstep conversion when customer lacks exact cash change. | `Pay via UPI`, `Reschedule with Cash`, `Cancel Order` |
| **`ndr_retention_en`** | UTILITY | High-urgency RTO arrest & cancellation interception. | `Pay via UPI`, `Confirm Cancel` |

### Multi-Step Interactive Workflows:
1. **Reschedule Sub-Tree**: Customer chooses between `Tomorrow`, `Day After Tomorrow`, or `This Weekend`. The selected ISO date is committed to the courier's reattempt scheduler.
2. **2-Step Address Flow**:
   - **Step 1**: Customer drops a live WhatsApp location pin (reverse geocoded via OpenStreetMap Nominatim with $\pm 4$m precision) or sends colloquial text instructions.
   - **Step 2**: Gemini AI NLP extracts landmarks and prompts for building/floor details. Coordinates and notes are merged and injected into the courier driver app.

---

## 💻 Tech Stack & Architecture

### Frontend Application (`/frontend`)
- **Core**: React 19, TypeScript 5, Vite 6.
- **Animation & Motion**: Motion for React (`motion/react` v12) with spring physics and full `prefers-reduced-motion` compliance.
- **Styling**: Vanilla CSS Design Tokens, BEM methodology, theme-locked dark surface palette (`--bg-surface`, `--indigo-08`, `--emerald-15`).
- **Icons**: Lucide React (`lucide-react`).
- **Data Visualization**: Recharts (`recharts` v2) for RTO analytics and delivery trend dashboards.
- **Testing**: Playwright test suite (90 passing end-to-end tests across Desktop Chromium and Mobile Chrome).

### Backend Engine (`/src`)
- **Runtime**: Node.js v20+, Express 5, TypeScript.
- **Database**: MongoDB with Mongoose (strict multi-tenant isolation by `merchantId`).
- **Background Queues**: Redis (ioredis), BullMQ for asynchronous webhook dispatch, retry backoffs, and escalation workers.
- **Security & Cryptography**: AES-256-GCM encryption for stored merchant carrier tokens and payment keys (`encryption.service.ts`), HMAC SHA-256 webhook signatures.
- **Logistics APIs**: Native connectors for Shiprocket, Delhivery, Blue Dart Express (DHL), Xpressbees, Shadowfax, Ecom Express, DTDC, ClickPost, and universal custom couriers/aggregators.
- **Payment Gateways**: Razorpay and Cashfree UPI intent generation and webhook capture.

---

## 🛠️ Local Development & Setup

### Prerequisites
- Node.js >= 20.x
- MongoDB >= 6.0
- Redis >= 6.2

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-org/rescueship.git
cd rescueship

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rescueship
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secure_32_character_jwt_secret
ENCRYPTION_KEY=your_secure_32_character_aes_encryption_key
FRONTEND_URL=http://localhost:5173

# Optional: Logistics & Meta Cloud API Credentials
WHATSAPP_TOKEN=your_meta_system_user_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### 3. Running Locally
```bash
# Terminal 1: Run Backend Engine
npm run dev

# Terminal 2: Run Frontend App
cd frontend
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Backend REST API: `http://localhost:3000`

---

## 🛡️ Recovery Flows, Dispute Resolution & Anti-Exploitation Architecture

RescueShip features a battle-hardened recovery and dispute resolution system designed specifically for the realities of Indian D2C fulfillment:

### 1. Two-Tab Recovery Console (`/templates`)
- **Tab 1: Flow Simulator & 5 Turnkey Playbooks**: Interactive decision tree simulator with dynamic pricing calculator (`Door Locked`, `Address & GPS Pin`, `COD → UPI Conversion`, `RTO Arrest`, and `Pre-Delivery High-Risk Verification`), equipped with 1-Click Meta Cloud API synchronization (`POST /api/templates/sync-meta`) and test rescue dispatches (`POST /api/templates/test-send`).
- **Tab 2: Real Customer Chat Audit & Dispute Center**: Live searchable WhatsApp thread inspector (`GET /api/orders/chats/recent`) with customer message histories, claimed UPI UTR transaction badges, payment reconciliation dossiers, and 1-click gateway verification.

### 2. Single-Select COD Incentive Strategy with Rupee Cap
- **Strict Mutual Exclusivity**: Merchants choose exactly one strategy (`none`, `percentage` with mandatory cap, or `flat`) to prevent pricing confusion, stacked discounts, or courier COD mismatch.
- **Margin Protection Cap**: Percentage discounts enforce a maximum rupee ceiling (e.g., ₹150 cap) ensuring that high-value orders (e.g., ₹10,000) do not surrender margins that exceed standard courier return freight savings (~₹140).
- **Anti-Exploitation Floor**: If `discount >= orderValue`, conversion is cleanly aborted to prevent negative paise / free order vulnerabilities.

### 3. Guarded "PAY" Triggering & Session Self-Healing
- **Case-Insensitive Matcher**: Supports `"pay"`, `"PAY"`, `"Pay"`, `"PAY."`, `"pay!"`, `"pay link"`, `"bhejo link"`, and `"link expired"`.
- **Anti-Jailbreak Gate**: If a customer replies "PAY" on an order that never received an initial payment link, the request is blocked and deflected with an interactive menu.
- **Self-Healing URLs (`/r/pay/:id`)**: If an expired payment link is opened, RescueShip validates the order and seamlessly 302-redirects to a freshly generated gateway session.
- **Retry Guidance Copy**: Links automatically include instructions: *"If your UPI session times out or payment fails, reply 'PAY' to get a fresh link immediately."*

### 4. Zero-Hallucination Out-of-Scope Deflection Shield
- **Eliminated Free-Text LLM Risks**: If customers ask arbitrary liability questions (*"Can I pay ₹500 now and ₹500 tomorrow?"* or *"Can I open the box before paying cash?"*), the assistant never generates open-ended hallucinated promises.
- **Explicit Warning Message**: The system immediately replies:
  > *⚠️ Incorrect or unsupported input. We are an automated delivery assistant and cannot process custom requests like partial payments or open box delivery.*
  followed by deterministic interactive options.

### 5. Strict Alphanumeric Address Preservation (`1A 104`, `B-4/201`)
- **Zero Mutation Invariant**: Gemini Flash address extraction is explicitly forbidden from altering, dropping, or reformatting alphanumeric flat/wing/house identifiers (`1A 104`, `Tower 3B Flat 501`, `Plot 45-B`).
- **Confidence Gating**: Any AI parse with confidence `< 0.60` falls back to deterministic regex heuristics, guaranteeing that courier labels preserve exact doorstep numbers.

---

## 🧪 Verification & Automated Testing

RescueShip maintains an exhaustive, mathematically proven testing posture across all layers:

- **Backend**: **49 test suites**, **415 tests (100% passing)** covering multi-carrier routing & parsers (all 8 carriers + custom), Cashfree v2023 UPI Intent & HMAC signature parity, multi-tenant merchant separation & credential isolation, anti-farming cancellation cooldowns, Nominatim IP throttling with Gemini NLP fallbacks, DPDP Act 180-day automated PII redaction, BullMQ Dead Letter Queue (`carrier-dlq`) for HTTP 429s, Redis `SET NX` concurrency locks with Lua atomic release, cross-tenant lock scoping, delayed-retry scan deduplication, Meta 24h tier limits, and graceful shutdown pipelines.
- **Frontend**: **5 test suites**, **90 Playwright E2E tests (100% passing)** covering all dashboard views, onboarding, sandbox, WCAG 2.1 AA accessibility compliance, and WhatsApp customer rescue simulators.

```bash
# 1. Run all backend tests (Jest)
npm test

# 2. Type-check backend
npx tsc --noEmit

# 3. Type-check & build frontend
cd frontend
npx tsc -b && npm run build
cd ..

# 4. Run full Playwright End-to-End Suite
npm run test:e2e
```

### Database Failure Telemetry Backfill

For existing orders missing location and failure attribution metadata, run the safe migration script:

```bash
# Preview changes (dry-run mode)
npx ts-node src/scripts/backfill-pincodes.ts --dry-run

# Execute database migration
npx ts-node src/scripts/backfill-pincodes.ts
```

---

## 🔒 Security & Tenant Governance

All developers and agents modifying this codebase must adhere to the rules in [DEVELOPER_RULES.md](./DEVELOPER_RULES.md):
- **Strict Tenant Scoping**: Every query must filter by authenticated `merchantId`.
- **HMAC Webhook Verification**: All incoming webhooks must be verified with their shared secret.
- **Encryption at Rest**: Never store plaintext third-party API credentials (all keys encrypted via AES-256-GCM).
- **Global Pause Adherence**: All background workers and dispatchers must check `merchant.settings.globalPause`.

### ⚡ Subsystem Architecture & Multi-Tenancy Fast Index

| Subsystem | Primary Code Location | Multi-Tenant Isolation & Security Invariant |
| :--- | :--- | :--- |
| **Settings & Discounts** | [`src/api/settings.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/settings.api.ts) | Extracts `merchantId` solely from verified JWT (`req.merchant.merchantId`). Mutates only `Merchant.findById(merchantId)`. |
| **Credentials Vault** | [`src/models/Merchant.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/models/Merchant.ts)<br>[`src/services/encryption.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/encryption.service.ts) | Encrypted at rest via AES-256-GCM. Redacted as `********` via `toSettingsDto()` on GET. |
| **Phone Collision Guard** | [`src/api/settings.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/settings.api.ts#L314) | Checks `Merchant.findOne({ _id: { $ne: merchant._id }, 'whatsappConfig.phoneNumberId' })` -> throws **409 Conflict**. |
| **COD Conversion Logic** | [`src/services/order.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/order.service.ts#L214) | Evaluates discounts strictly using `merchant.settings.codConversion` of the owning store. Zero cross-tenant leakage. |
| **Outbound WhatsApp** | [`src/services/whatsapp.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/whatsapp.service.ts#L86)<br>[`src/services/whatsapp/whatsapp-dispatcher.service.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/services/whatsapp/whatsapp-dispatcher.service.ts) | Decrypts and dispatches using the owning merchant's token only. Explicitly refuses platform fallback for customers. |
| **Inbound WhatsApp** | [`src/webhooks/whatsapp.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/whatsapp.webhook.ts#L130) | Resolves merchant from `metadata.phone_number_id` sent by Meta; scopes all message logs to that tenant. |
| **Store Webhooks** | [`src/webhooks/shopify.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/shopify.webhook.ts)<br>[`src/webhooks/woocommerce.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/woocommerce.webhook.ts) | Shopify derives tenant from signed shop domain. WooCommerce verifies per-merchant HMAC with `merchant_id`. |
| **Payment Webhooks** | [`src/webhooks/razorpay.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/razorpay.webhook.ts)<br>[`src/webhooks/cashfree.webhook.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/cashfree.webhook.ts) | Resolves owning merchant via `paymentLinkId` on `Order`, then validates against that merchant's gateway secret. |
| **Carrier Webhooks** | [`src/webhooks/carrier-auth.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/webhooks/carrier-auth.ts) | Authenticates inbound NDR using per-tenant `carrierConfig.webhookSecret`. |
| **Orders & Dispute Chats** | [`src/api/orders.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/orders.api.ts) | `Order.find({ merchantId })` & `MessageLog.find({ merchantId })`. Cross-tenant queries return 404. |
| **Templates Sandbox** | [`src/api/templates.api.ts`](file:///c:/Users/Konark%20Parihar/Desktop/wa/rescueship/src/api/templates.api.ts) | Every CRUD operation scoped by `{ merchantId }`. Merchants cannot read, modify, or delete foreign playbooks. |

### ⚠️ Testing Command Rule
When running individual Jest test files, always include `--forceExit` to guarantee immediate process termination and prevent hanging background tasks:
```bash
npx jest src/__tests__/merchant-separation.test.ts --forceExit
```

---

## 📄 License
ISC License. Copyright © 2026 RescueShip Inc. All rights reserved.
