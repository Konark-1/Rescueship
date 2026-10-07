# Integration Guide

Welcome to the RescueShip integration guide. This document explains how to set up webhooks for Shopify, WooCommerce, and custom integrations so that RescueShip can process your orders and handle NDRs effectively.

## 1. Shopify Integration

1. In your RescueShip Dashboard, navigate to **Settings > Integrations**.
2. Click on **Shopify** and generate your unique webhook secret.
3. In your Shopify Admin panel, go to **Settings > Notifications**.
4. Scroll down to **Webhooks** and click **Create webhook**.
5. Set the Event to `Order creation` and the Format to `JSON`.
6. Enter your RescueShip Webhook URL:
   `https://api.rescueship.com/webhooks/shopify`
7. Click **Save**.

Note: Shopify signs webhooks with a header `X-Shopify-Hmac-Sha256`. Ensure your RescueShip settings have the correct secret for verification. RescueShip ingests all orders (COD and Prepaid) to ensure customer phone numbers are stored for future carrier NDR delivery rescues.

## 2. WooCommerce Integration

1. In your RescueShip Dashboard, get your WooCommerce webhook secret key.
2. In your WordPress Admin, go to **WooCommerce > Settings > Advanced > Webhooks**.
3. Click **Add webhook**.
4. Set the Status to `Active` and Topic to `Order created`.
5. Delivery URL: `https://api.rescueship.com/webhooks/woocommerce`
6. Secret: Use the secret key from your RescueShip dashboard.
7. Click **Save Webhook**.

> **Universal Ingestion Note**: RescueShip processes both Cash on Delivery and Prepaid orders. Ingesting prepaid orders preserves consignee contact details so that when courier partners report non-delivery issues (NDR), RescueShip can immediately engage the buyer for delivery rescheduling or address verification.

## 3. Custom Integration (Custom Webhooks)

If you are using a custom backend, you can send webhooks directly to our custom webhook endpoint.

- **URL:** `https://api.rescueship.com/webhooks/custom`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `x-rescueship-signature: <hmac_signature>` (calculated using HMAC SHA256 of the raw body using your RescueShip API key).

### Payload Example:
```json
{
  "event": "order.created",
  "data": {
    "orderId": "12345",
    "customer": {
      "name": "John Doe",
      "phone": "9876543210"
    },
    "paymentMethod": "cod",
    "amount": 1500
  }
}
```

---

## 4. Meta WhatsApp Cloud API Integration

RescueShip receives customer responses (reschedule confirmations, address edits, and live GPS pins) through the Meta Cloud API webhook.

1. In the **Meta App Dashboard**, navigate to **WhatsApp > Configuration**.
2. Set the **Callback URL** to:
   `https://rescueship.onrender.com/webhooks/whatsapp`
3. Enter the **Verify Token**:
   Use the value configured in your `META_VERIFY_TOKEN` (or `WHATSAPP_VERIFY_TOKEN`) environment variable.
4. Click **Verify and Save**. RescueShip will immediately complete the `hub.challenge` handshake with HTTP 200.
5. In **Webhook Fields**, subscribe to `messages`.

---

## 5. Courier NDR Webhook Configuration

RescueShip supports India's top 8 logistics networks and aggregators (Shiprocket, Delhivery, Blue Dart, Xpressbees, Shadowfax, Ecom Express, DTDC, ClickPost):

1. **Webhook Endpoint Template**:
   `https://rescueship.onrender.com/webhooks/<carrier>/ndr?merchant_id=<your_merchant_id>`
   *(e.g., `/webhooks/shiprocket/ndr?merchant_id=650000000000000000000001`)*
2. **Authentication**:
   Configure the webhook secret in your carrier dashboard and pass either:
   - Header `x-api-key: <merchant_carrier_secret>`, or
   - Carrier-specific signature header (e.g., `x-webhook-signature` for Shiprocket).
3. **Payload Standard**:
   RescueShip supports Shiprocket v2 nested schemas (`{ "data": { "shipment_status": "...", "awb_code": "..." } }`) alongside legacy v1 formats.

---

## 6. Payment Gateway Integrations (Razorpay & Cashfree)

RescueShip uses payment gateways for self-funding COD-to-prepaid conversions:

### Razorpay
1. In your Razorpay Dashboard, navigate to **Settings > Webhooks**.
2. Add Webhook URL: `https://rescueship.onrender.com/webhooks/razorpay`
3. Subscribe to events: `payment.captured`, `payment_link.paid`.
4. In RescueShip, use **Settings > Test Webhook Connection** to send an instant verification probe.

### Cashfree (v2023 API)
1. In your Cashfree Merchant Dashboard, go to **Developers > Webhooks**.
2. Add Webhook URL: `https://rescueship.onrender.com/webhooks/cashfree`
3. Set API Version to `2023-08-01`.
4. Subscribe to `ORDER_PAID`.
5. Cashfree webhooks are verified via HMAC SHA-256 signatures (`x-webhook-signature`) with automatic replay window validation.

