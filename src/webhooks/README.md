# webhooks/

> **Purpose**: Inbound webhook ingestion handlers — receive and process events from e-commerce platforms, carriers, payment gateways, and Meta WhatsApp.

## File Catalog

| File | Source | Events Handled |
|------|--------|----------------|
| `shopify.webhook.ts` | Shopify | `orders/create`, `orders/updated`, `fulfillments/create` |
| `woocommerce.webhook.ts` | WooCommerce | `order.created`, `order.updated` |
| `shiprocket.webhook.ts` | Shiprocket | Delivery status updates, NDR events |
| `delhivery.webhook.ts` | Delhivery | Shipment tracking, NDR events |
| `clickpost.webhook.ts` | ClickPost | Delivery status, NDR events |
| `whatsapp.webhook.ts` | Meta Cloud API | Inbound customer messages (text, buttons, GPS pins), delivery status callbacks |
| `razorpay.webhook.ts` | Razorpay | `payment.captured`, `payment_link.paid`, `subscription.*` |
| `cashfree.webhook.ts` | Cashfree | Payment confirmations |
| `custom.webhook.ts` | Custom ERP | Generic order creation webhook |
| `carrier-ndr.handler.ts` | Shared | Unified NDR processing factory for all carriers |
| `carrier-auth.ts` | Shared | `generateCarrierWebhookSecret()` for HMAC verification |

## Architecture & Data Flow

`Webhook → HMAC verification (../middleware/webhookVerify.ts) → Schema validation (../schemas/) → Idempotency check (../utils/idempotency.ts) → BullMQ job dispatch → Worker processing`

## Key Invariants

- ALL webhooks MUST verify HMAC signatures — unsigned requests rejected with 401
- ALL webhooks MUST pass through idempotency guard — duplicate events silently dropped
- Headers: Shopify `X-Shopify-Hmac-Sha256`, Razorpay `X-Razorpay-Signature`, Meta `X-Hub-Signature-256`, WooCommerce `X-WC-Webhook-Signature`
- Handlers MUST return 200 quickly and defer processing to BullMQ jobs
- `carrier-ndr.handler.ts` is the shared NDR entry point for all carrier webhooks

## Agent Cheat Sheet

- To add a new webhook source: Create `provider.webhook.ts`, add HMAC in `../middleware/webhookVerify.ts`, add Zod schema in `../schemas/`, mount in `../index.ts` under `/webhooks/provider`
- To debug: Check `WebhookEvent` model for raw payload logs
