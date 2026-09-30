# RescueShip API Documentation

- **Production API**: `https://rescueship.onrender.com/api`
- **Development API**: `http://localhost:3000/api`

---

## System & Infrastructure Endpoints

### 1. Health Probe
- **Method:** `GET /health`
- **Authentication:** Public
- **Response:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-01T01:00:00.000Z",
    "uptime": 1250.4,
    "checks": {
      "mongodb": "ok",
      "redis": "ok"
    }
  }
  ```

### 2. WhatsApp Payment Redirection
- **Method:** `GET /r/pay/:id`
- **Authentication:** Public (WhatsApp URL CTA target)
- **Response:** `302 Found` redirecting to active Razorpay/Cashfree payment link.

---

## Authentication (`/auth`)

### 1. Register Merchant
- **Method:** `POST /auth/register`
- **Body Schema:**
  ```json
  {
    "companyName": "My Store",
    "email": "owner@store.com",
    "password": "securepassword123",
    "phone": "9876543210"
  }
  ```
- **Response:**
  ```json
  {
    "token": "jwt_token_string",
    "merchantId": "id_string"
  }
  ```

### 2. Login
- **Method:** `POST /auth/login`
- **Body Schema:**
  ```json
  {
    "email": "owner@store.com",
    "password": "securepassword123"
  }
  ```
- **Response:**
  ```json
  {
    "token": "jwt_token_string"
  }
  ```

## Settings (`/settings`)

Headers required: `Authorization: Bearer <token>`

### 1. Get Settings
- **Method:** `GET /settings`
- **Response:** Merchant settings object.

### 2. Update Settings
- **Method:** `PUT /settings`
- **Body Schema:** Any updatable settings fields.
- **Response:** Updated settings object.

## Analytics (`/analytics`)

Headers required: `Authorization: Bearer <token>`

### 1. Get Dashboard
- **Method:** `GET /analytics/dashboard`
- **Query Params:** `startDate` (ISO string), `endDate` (ISO string)
- **Response:**
  ```json
  {
    "totalOrders": 100,
    "codOrders": 60,
    "prepaidOrders": 40,
    "ndrCount": 10,
    "rescuedCount": 5,
    "rescueRate": 50,
    "conversionCount": 20,
    "conversionRate": 33.3,
    "totalRevenueSaved": 2000,
    "carrierBreakdown": []
  }
  ```

## Orders (`/orders`)

Headers required: `Authorization: Bearer <token>`

### 1. List Orders
- **Method:** `GET /orders`
- **Query Params:** `page`, `limit`, `status`
- **Response:** List of orders with pagination meta.

### 2. Get Order by ID
- **Method:** `GET /orders/:id`
- **Response:** Single order object.

## Billing, Templates, and Audit Logs

These resources will follow the standard CRUD API structure and require `Authorization: Bearer <token>`. 
- `GET /templates` - fetch communication templates.
- `GET /billing/plan` - current billing state (plan, cycle, status, limits, credits).
- `GET /billing/status` - `{ active, plan, cycle, limit, renewMonthly, activatedAt, nextInvoice, status, credits, cancelAtCycleEnd }`.
- `GET /billing/usage` - billing event ledger (recent usage events).
- `GET /billing/invoices` - get recent invoices (intro purchases, monthly renewals, credit top-ups).
- `POST /billing/checkout` `{ tier, cycle }` - create the upfront Razorpay order + renewal mandate.
- `POST /billing/checkout/verify` `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` - verify payment and provision the plan.
- `POST /billing/cancel` - schedule cancel-at-cycle-end (access continues until the period ends).
- `POST /billing/resume` - un-pause / clear a scheduled cancellation.
- `GET /billing/credits/packs` - rescue-credit top-up catalogue.
- `POST /billing/credits/checkout` `{ pack }` - create a one-time Razorpay order for a credit pack.
- `POST /billing/credits/verify` `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` - verify payment and add credits.
- `GET /audit-logs` - get recent activity logs.

**Subscription enforcement:** orders, analytics, realtime, AI, templates, exports, metrics and audit-log routes require an ACTIVE subscription (grace-period, trial and paid merchants pass; expired/cancelled/quota-exceeded merchants receive `403 SUBSCRIPTION_INACTIVE`). Billing, settings, auth and connect routes stay reachable for renewal and account access.

**Platform subscriptions are Razorpay-only.** Cashfree is used exclusively for per-merchant COD-conversion payment links.

## Sandbox & Testing (`/sandbox`)
Headers required: `Authorization: Bearer <token>`

- `GET /sandbox/scenarios` - list pre-configured simulation scenarios (premises locked, wrong address, fake attempt, COD refusal).
- `POST /sandbox/simulate-webhook` - dispatch mock carrier or WhatsApp webhook payload through the real state machine without external network calls.
- `POST /sandbox/reset` - reset merchant sandbox test data.

## Exports (`/export`)
Headers required: `Authorization: Bearer <token>` (Rate limit: 5 requests/minute)

- `GET /export/orders` - stream filtered orders as CSV with headers matching Shopify/Delhivery format.

## Realtime SSE Stream (`/realtime`)
Headers required: `Authorization: Bearer <token>`

- `GET /realtime/stream` - Server-Sent Events stream delivering live events: `ndr_detected`, `ndr_rescued`, `rto_initiated`, `payment_received`.

## Product-Led Growth & Onboarding (`/plg`)

- `POST /plg/simulate` - public interactive simulator for landing page prospects.
- `POST /plg/book-demo` - merchant lead capture sending instant notifications to founder email.

## Webhooks (`/webhooks`)

Webhooks receive real-time updates from carriers, payment gateways, and WhatsApp. Verified via HMAC SHA-256 signatures.

- `POST /webhooks/shopify` (`X-Shopify-Hmac-Sha256`)
- `POST /webhooks/woocommerce` (`X-WC-Webhook-Signature`)
- `POST /webhooks/shiprocket` (`x-webhook-signature`)
- `POST /webhooks/delhivery` (`X-Hub-Signature-256`)
- `POST /webhooks/clickpost` (`X-ClickPost-Signature`)
- `POST /webhooks/whatsapp` (Meta Cloud API v22.0 signature)
- `POST /webhooks/razorpay` (`X-Razorpay-Signature`)
- `POST /webhooks/cashfree` (`X-Cashfree-Signature`)
- `POST /webhooks/payment` (Unified payment capture dispatcher)
- `POST /webhooks/custom` (Custom ERP / enterprise webhook)

See `INTEGRATION_GUIDE.md` for webhook setup.
