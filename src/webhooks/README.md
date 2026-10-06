# webhooks/

> **Purpose**: Inbound webhook ingestion handlers — receive and process events from e-commerce platforms, carriers, payment gateways, and Meta WhatsApp.

## File Catalog

| File | Source | Events Handled |
|------|--------|----------------|
| `shopify.webhook.ts` | Shopify | `orders/create`, `orders/updated`, `fulfillments/create` — Universal ingestion for both COD and Prepaid orders (`paymentMethod: 'prepaid'` saved to DB, phone normalized with `normalizeIndianPhone`, auto-reconciles quarantined shipments matching fulfillments) |
| `woocommerce.webhook.ts` | WooCommerce | `order.created`, `order.updated` — Universal ingestion for both COD and Prepaid orders (`paymentMethod: 'prepaid'` saved to DB, phone normalized with `normalizeIndianPhone`, increments `billing.currentMonthOrders`, auto-reconciles quarantined shipments matching metadata) |
| `shiprocket.webhook.ts` | Shiprocket | Delivery status updates, NDR events (`/webhooks/shiprocket/ndr`) |
| `delhivery.webhook.ts` | Delhivery | Shipment tracking, NDR events (`/webhooks/delhivery/ndr`) |
| `bluedart.webhook.ts` | Blue Dart Express | Waybill tracking, delivery failure & NDR remarks (`/webhooks/bluedart/ndr`) |
| `xpressbees.webhook.ts` | Xpressbees | Real-time NDR status & failed delivery events (`/webhooks/xpressbees/ndr`) |
| `shadowfax.webhook.ts` | Shadowfax | Doorstep delivery exceptions & NDR callbacks (`/webhooks/shadowfax/ndr`) |
| `ecomexpress.webhook.ts` | Ecom Express | Field remarks & undelivered status notifications (`/webhooks/ecomexpress/ndr`) |
| `dtdc.webhook.ts` | DTDC | Consignment status & delivery exception tracking (`/webhooks/dtdc/ndr`) |
| `clickpost.webhook.ts` | ClickPost | Logistics intelligence & NDR events (`/webhooks/clickpost/ndr`) |
| `custom.webhook.ts` | Custom ERP / Couriers | Universal order creation (`/webhooks/custom/order`) and universal NDR ingestion (`/webhooks/custom/ndr`) |
| `whatsapp.webhook.ts` | Meta Cloud API | Inbound customer messages (text, buttons, GPS pins), delivery status callbacks |
| `razorpay.webhook.ts` | Razorpay | `payment.captured`, `payment_link.paid`, `subscription.*` |
| `cashfree.webhook.ts` | Cashfree | Payment confirmations (`/webhooks/cashfree`) |
| `payment.webhook.ts` | Payment Gateways | Universal payment capture webhook fallback |
| `carrier-ndr.handler.ts` | Shared | Unified NDR processing factory for all 8 carriers + custom aggregators |
| `carrier-auth.ts` | Shared | `generateCarrierWebhookSecret()`, HMAC validation, and tenant auth token verification |

## Architecture & Data Flow

`Webhook → HMAC verification (../middleware/webhookVerify.ts) → Schema validation (../schemas/) → Idempotency check (../utils/idempotency.ts) → BullMQ job dispatch → Worker processing`

## Key Invariants

- ALL webhooks MUST verify HMAC signatures — unsigned requests rejected with 401
- ALL webhooks MUST pass through idempotency guard — duplicate events silently dropped
- Headers: Shopify `X-Shopify-Hmac-Sha256`, Razorpay `X-Razorpay-Signature`, Meta `X-Hub-Signature-256`, WooCommerce `X-WC-Webhook-Signature`
- Handlers MUST return 200 quickly and defer processing to BullMQ jobs
- Courier webhooks accept tenant context via `?merchant_id={merchantId}` and authenticate via carrier secret or tenant token
- `carrier-ndr.handler.ts` is the shared NDR entry point for all 8 carriers and custom aggregators
- **Universal Order Ingestion Invariant**: Neither Shopify nor WooCommerce ignores prepaid orders. Storing both prepaid and COD orders preserves consignee contact numbers in MongoDB, guaranteeing 100% downstream carrier NDR rescue coverage even when carrier webhooks omit phone numbers.

## Agent Cheat Sheet

- To add a new webhook source: Create `provider.webhook.ts`, add HMAC in `../middleware/webhookVerify.ts`, add Zod schema in `../schemas/`, mount in `../index.ts` under `/webhooks/provider`
- To debug: Check `WebhookEvent` model for raw payload logs
