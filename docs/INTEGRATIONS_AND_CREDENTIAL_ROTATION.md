# 🔌 RescueShip — Integrations & Credential Rotation Architecture

**Production Architecture & Operational Playbook for Merchant Credential Management, Account Switching & Key Rotation**  
*Maintained by RescueShip Core Engineering*  
*Target Environments: Shopify, Meta WhatsApp Cloud API, Shiprocket/Delhivery/ClickPost, Razorpay/Cashfree*

---

## 🎯 Executive Overview & Motivation

In e-commerce operations, merchants frequently need to change, rotate, or reconfigure their underlying infrastructure:
1. **Meta WhatsApp 24-Hour Tokens**: Temporary test tokens expire after 24 hours and must be renewed, or replaced with permanent System User Tokens.
2. **Shopify Store Migration**: Moving from a development/staging sandbox (`store-dev.myshopify.com`) to a live production domain, or regenerating custom app Admin API access tokens (`shpat_...`).
3. **Courier Password/API Key Rotation**: Changing Shiprocket passwords, rotating Delhivery API tokens, or switching primary courier partners.
4. **Payment Gateway Secrets**: Rotating Razorpay Key Secrets or switching from Razorpay to Cashfree.

This document outlines the **Config APIs**, **Credential Encryption Lifecycles**, and the **Merchant UI Architecture** for self-serve credential rotation.

---

## 🛠️ Complete Architecture & API Specification

### 1. Unified Credential Storage & Encryption Architecture
All sensitive merchant keys are encrypted with **AES-256-GCM** using `ENCRYPTION_KEY` before writing to MongoDB Atlas. Keys are **never stored in plaintext** and **never returned to the frontend** (redacted with `********`).

```
┌────────────────────────────────────────────────────────┐
│ Merchant Frontend (Integrations / Settings UI)         │
└───────────────────────────┬────────────────────────────┘
                            │
               HTTPS (Bearer JWT Auth)
                            │
┌───────────────────────────▼────────────────────────────┐
│ RescueShip API Gateway (Express 5 + Strict Limiter)    │
│  - credentialValidationLimiter (Prevents Brute-Force)  │
└───────────────────────────┬────────────────────────────┘
                            │
              Pre-Flight Validation Probe
                            │
      ┌─────────────────────┼─────────────────────┐
      ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Meta Graph   │      │ Shopify Admin│      │ Carrier / PG │
│ Probe        │      │ Probe        │      │ Probe        │
└──────────────┘      └──────────────┘      └──────────────┘
      │                     │                     │
      └─────────────────────┼─────────────────────┘
                            │ (Only if 200 OK)
┌───────────────────────────▼────────────────────────────┐
│ Encryption Service (AES-256-GCM with Random 12-byte IV)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ MongoDB Atlas (Encrypted Credential Fields)            │
│  - whatsappConfig.accessToken                          │
│  - platformConfig.shopifyAccessToken                   │
│  - carrierConfig.password / apiToken                   │
│  - paymentConfig.keySecret                             │
└────────────────────────────────────────────────────────┘
```

---

## 📡 Dedicated Config APIs (Backend Endpoints)

| Endpoint | Method | Purpose | Payload |
| :--- | :---: | :--- | :--- |
| **`/api/connect/status`** | `GET` | Fetches live connection health of all 4 stations | None (Returns `{ connections, ready, storeName, ownerPhone }`) |
| **`/api/connect/whatsapp/manual`** | `POST` | Updates/rotates Meta WhatsApp credentials | `{ phoneNumberId, wabaId, accessToken }` |
| **`/api/connect/whatsapp/test-pulse`**| `POST` | Sends live test message to owner phone | None (uses verified `ownerPhone`) |
| **`/api/connect/shopify/custom`** | `POST` | Updates/rotates Shopify Custom App tokens | `{ shopDomain, accessToken, apiSecretKey }` |
| **`/api/connect/woocommerce`** | `POST` | Updates WooCommerce REST credentials | `{ url, consumerKey, consumerSecret }` |
| **`/api/connect/carrier`** | `POST` | Updates courier partner credentials | `{ provider, email, password, apiKey, apiToken }` |
| **`/api/connect/carrier/disconnect`** | `POST` | Safely disconnects courier partner | None |
| **`/api/connect/carrier/webhook`** | `GET` | Generates per-merchant carrier webhook secret | None |
| **`/api/connect/payment`** | `POST` | Updates payment gateway credentials | `{ gateway: 'razorpay'\|'cashfree', keyId, keySecret }` |
| **`/api/connect/owner-phone`** | `POST` | Updates merchant's owner mobile number | `{ ownerPhone: '+91...' }` |
| **`/api/settings`** | `PUT` | Unified bulk update of settings & encrypted keys | Full settings DTO |

---

## 📋 Comprehensive Merchant Reconfiguration TODO Checklist

### Phase 1: Meta WhatsApp Token Renewal & Permanent Token Setup
- [ ] **Current State**: Temporary 24-hour token configured for testing.
- [ ] **Action Required for Production**:
  1. In Meta Business Manager, navigate to **System Users** &rarr; create a permanent System User (`RescueShip-System`).
  2. Assign the **WhatsApp Business Account** asset with **Full Control**.
  3. Click **Generate Token** &rarr; select scopes:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
  4. Select expiration: **Never**.
  5. In RescueShip dashboard, navigate to **Integrations &rarr; WhatsApp** and paste the permanent System User token.
  6. Click **Save & Test Connection**.

---

### Phase 2: Shopify Account Switching & Custom App Rotation
- [ ] **Moving from Dev Store to Live Store**:
  1. Open Shopify Admin of the target store &rarr; **Settings** &rarr; **Apps and sales channels** &rarr; **Develop apps**.
  2. Create an app named `RescueShip Engine`.
  3. Configure Admin API scopes:
     - `read_orders`, `write_orders`
     - `read_fulfillments`, `write_fulfillments`
     - `read_products`
  4. Click **Install app** and copy the **Admin API access token** (`shpat_...`).
  5. In RescueShip, call `POST /api/connect/shopify/custom` or use the dashboard UI:
     ```json
     {
       "shopDomain": "yourbrand.myshopify.com",
       "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxx",
       "apiSecretKey": "shpss_xxxxxxxxxxxxxxxxxxxx"
     }
     ```
  6. RescueShip automatically probes `GET https://yourbrand.myshopify.com/admin/api/2024-04/shop.json` to verify validity before committing.

---

### Phase 3: Courier Partner Credential Rotation (Shiprocket / Delhivery)
- [ ] **When Shiprocket password changes**:
  1. Call `POST /api/connect/carrier`:
     ```json
     {
       "provider": "shiprocket",
       "email": "logistics@yourbrand.com",
       "password": "NewSecurePassword123!"
     }
     ```
  2. RescueShip invokes Shiprocket auth API (`POST https://apiv2.shiprocket.in/v1/external/auth/login`) to acquire a fresh JWT bearer token.
- [ ] **When Delhivery API key is rotated**:
  1. Call `POST /api/connect/carrier`:
     ```json
     {
       "provider": "delhivery",
       "apiKey": "dlhv_live_xxxxxxxxxxxxxxxx"
     }
     ```
  2. RescueShip verifies the key against Delhivery's live tracking gateway.

---

### Phase 4: Payment Gateway Rotation (Razorpay / Cashfree)
- [ ] **Rotating Razorpay Keys**:
  1. In Razorpay Dashboard &rarr; **Settings** &rarr; **API Keys** &rarr; **Generate Key**.
  2. Update in RescueShip via `POST /api/connect/payment`:
     ```json
     {
       "gateway": "razorpay",
       "keyId": "rzp_live_xxxxxxxxxxxx",
       "keySecret": "NewSecretKey123xxxxxxxx"
     }
     ```
  3. RescueShip tests auth against `https://api.razorpay.com/v1/payment_links` before saving.
- [ ] **Switching to Cashfree**:
  1. Switch `gateway` to `"cashfree"` with Cashfree Client ID & Client Secret.

---

## 🎨 Recommended UI Enhancements (Next Iteration)

To give merchants maximum self-serve flexibility:
1. **Dedicated `/integrations` Page in Sidebar**:
   - Display 4 high-end cards:
     - 🛍️ **E-Commerce Store** (Shopify / WooCommerce / Custom)
     - 💬 **WhatsApp Business API** (Meta Cloud API / WABA)
     - 🚚 **Logistics Courier** (Shiprocket / Delhivery / ClickPost)
     - 💳 **Payment Gateway** (Razorpay / Cashfree)
2. **Card State Indicators**:
   - `🟢 Connected` with masked identifier (e.g. `1370233809508386`, `konark-uuoyyw2i.myshopify.com`)
   - `🟡 Token Expiring Soon` warning for temporary tokens
   - `🔴 Disconnected`
3. **Modal Actions on Each Card**:
   - `🔄 Reconfigure / Update Keys`
   - `⚡ Test Connection Ping`
   - `🔌 Disconnect Station`
