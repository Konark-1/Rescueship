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

Note: Shopify signs webhooks with a header `X-Shopify-Hmac-Sha256`. Ensure your RescueShip settings have the correct secret for verification.

## 2. WooCommerce Integration

1. In your RescueShip Dashboard, get your WooCommerce webhook secret key.
2. In your WordPress Admin, go to **WooCommerce > Settings > Advanced > Webhooks**.
3. Click **Add webhook**.
4. Set the Status to `Active` and Topic to `Order created`.
5. Delivery URL: `https://api.rescueship.com/webhooks/woocommerce`
6. Secret: Use the secret key from your RescueShip dashboard.
7. Click **Save Webhook**.

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
