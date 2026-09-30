# 🚢 RescueShip — Autonomous WhatsApp NDR Interception & RTO Recovery Engine

[![Production Frontend](https://img.shields.io/badge/Render-rescueship--frontend.onrender.com-46E3B7?style=flat&logo=render)](https://rescueship-frontend.onrender.com)
[![Production Backend](https://img.shields.io/badge/Render-rescueship.onrender.com-46E3B7?style=flat&logo=render)](https://rescueship.onrender.com)
[![Test Suite](https://img.shields.io/badge/Tests-276%20passed%20(36%20suites)-brightgreen?style=flat&logo=jest)](https://github.com/Konark-1/Rescueship)
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
                                    │    (Delhivery / Shiprocket / ClickPost / Bluedart)    │
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
                                    │    • Line-haul return transit halted in hub            │
                                    └────────────────────────────────────────────────────────┘
```

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
- **Logistics APIs**: Native connectors for Delhivery, Shiprocket, ClickPost, and generic webhooks.
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

## 🧪 Verification & Automated Testing

RescueShip maintains an exhaustive, mathematically proven testing posture across all layers:

- **Backend**: **36 test suites**, **276 tests (100% passing)** covering webhook HMACs, carrier APIs, 3-mode address correction, atomic `SET NX` concurrency locks, rate limiting, and failure telemetry.
- **Frontend**: **5 test suites**, **90 Playwright E2E tests (100% passing)** covering all dashboard views, onboarding, sandbox, and WhatsApp customer rescue simulators.

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

All developers modifying this codebase must adhere to the rules in [DEVELOPER_RULES.md](./DEVELOPER_RULES.md):
- **Strict Tenant Scoping**: Every query must filter by authenticated `merchantId`.
- **HMAC Webhook Verification**: All incoming webhooks must be verified with their shared secret.
- **Encryption at Rest**: Never store plaintext third-party API credentials.
- **Global Pause Adherence**: All background workers and dispatchers must check `merchant.settings.globalPause`.

---

## 📄 License
ISC License. Copyright © 2026 RescueShip Inc. All rights reserved.
