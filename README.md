# 🚢 RescueShip — Autonomous COD Conversion & NDR Rescue Engine for D2C E-Commerce

[![Node.js](https://img.shields.io/badge/Node.js-v20+-emerald.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-v19-cyan.svg)](https://react.dev/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5-orange.svg)](https://bullmq.io/)
[![License](https://img.shields.io/badge/License-ISC-purple.svg)](#license)

RescueShip is an enterprise-grade SaaS platform built to help D2C e-commerce brands in India drastically reduce RTO (Return to Origin) losses. It features automated COD-to-Prepaid conversion workflows, WhatsApp-native fake remark detection, 3-mode smart address correction (Location Pin, Text Address, Both), and instant carrier API synchronization.

---

## 🌟 Key Capabilities

### 1. 📍 3-Mode Smart Address Correction (Headline Feature)
Intercepts failed delivery attempts (NDRs) on WhatsApp and collects updated delivery instructions using 3 flexible modes:
- **Location Pin Mode**: Reverses geocodes Google Maps GPS pins into precise street addresses via OpenStreetMap Nominatim API.
- **Text Address Mode**: Parses structured floor, tower, room number, or landmark details.
- **Both Mode (Recommended)**: 2-step interactive collection flow combining GPS coordinates + building/floor details into an enriched destination address pushed directly to the driver app.

### 2. 💳 COD-to-Prepaid Conversion & UPI QR Engine
- Automatically triggers personalized WhatsApp conversion flows for newly placed COD orders.
- Generates dynamic Razorpay/Cashfree payment links and UPI QR code images.
- Dispatches QR code images via WhatsApp media messages with instant discount incentives.
- Sends instant real-time WhatsApp alerts to sellers upon payment confirmation.

### 3. 🎯 Fake Remark Detection & Escalation Engine
- Time & speed heuristics flag suspicious courier delivery failure remarks (e.g. late-night attempts outside 8 AM - 10 PM).
- Multi-tier escalation worker with customizable cooldown intervals (4h, 12h, 24h).

### 4. 💰 Multi-Tier Order Subscription Billing
- Order-based subscription tiers: **Starter** (2,000 orders/mo), **Growth** (10,000 orders/mo), **Scale** (50,000 orders/mo), and **Enterprise** (Custom).
- Integrated Razorpay Subscription Checkout Engine for automated plan activation and usage resetting.

---

## 🏗️ Architecture & Technology Stack

- **Backend Core**: Node.js, Express 5, TypeScript.
- **Database & Queueing**: MongoDB (Mongoose), Redis (ioredis), BullMQ background workers.
- **Frontend UI**: React 19, Vite, Framer Motion (`motion/react`), Vanilla CSS Design Tokens, Lucide Icons, Recharts.
- **Integrations**: Meta WhatsApp Cloud API (v22.0), Razorpay, Cashfree, Shiprocket, Delhivery, ClickPost.

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js >= 20.x
- MongoDB Server >= 6.0
- Redis Server >= 6.2

### 1. Clone Repository & Install Dependencies
```bash
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
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```

Ensure mandatory variables are configured:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rescueship
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secure_32_character_jwt_secret
ENCRYPTION_KEY=your_secure_32_character_aes_key
```

### 3. Development Server
```bash
# Start backend engine in development mode
npm run dev

# Start frontend development server (in separate terminal)
cd frontend
npm run dev
```

The backend server runs on `http://localhost:3000` and the frontend application runs on `http://localhost:5173`.

---

## 🧪 Testing & Verification

```bash
# Run backend TypeScript type-check
npx tsc --noEmit

# Run backend unit tests
npm test

# Build production frontend bundle
cd frontend
npm run build
```

---

## 🔒 Security & Developer Guidelines

All developers modifying the codebase MUST adhere to [DEVELOPER_RULES.md](./DEVELOPER_RULES.md):
- **Tenant Isolation**: Every database query MUST filter by `merchantId: req.merchant.merchantId`.
- **HMAC Signatures**: All incoming webhook endpoints MUST verify HMAC signature headers.
- **Credential Encryption**: Store all third-party API tokens encrypted via `encryption.service.ts` (AES-256-GCM).
- **Global Pause Check**: Background workers MUST respect `settings.globalPause`.

---

## 📄 License
ISC License. Copyright © 2026 RescueShip Inc. All rights reserved.
