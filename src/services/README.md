# services/

> **Purpose**: Business logic services — 30 service modules implementing RescueShip's core COD rescue, NDR processing, carrier integration, payments, analytics, and WhatsApp automation.

## File Catalog

| File | Role | Pattern |
|------|------|---------|
| `ndr.service.ts` | Central NDR pipeline | Singleton — remark classification, prepaid remark sanitization (`COD_COLLECTION_ISSUE` → `CUSTOMER_NOT_AVAILABLE`), fake scoring, policy eval, customer response processing, automated `rtoFeeSaved` and `NdrCase` metrics |
| `order.service.ts` | COD conversion | Singleton — payment link creation, UPI QR, Shopify/WooCommerce ledger updates |
| `address-correction.service.ts` | 3-mode address engine | Singleton — Nominatim geocoding, Gemini AI parsing, carrier sync, automated `rtoFeeSaved` and `NdrCase` metrics |
| `gemini.service.ts` | Gemini AI parser | Singleton — colloquial Indian address extraction via Gemini 2.5 Flash |
| `analytics.service.ts` | Dashboard analytics | Singleton — `getDashboardData()`, conversions, carrier performance |
| `email.service.ts` | Email delivery | Singleton — Gmail SMTP over TLS/SSL port 465 |
| `encryption.service.ts` | AES-256-GCM | Singleton — `encrypt()`, `decrypt()`, supports legacy formats |
| `export.service.ts` | Data export | Singleton — CSV/JSON with formula injection sanitization |
| `geocoding.service.ts` | Reverse geocoding | Singleton — OpenStreetMap Nominatim with two-tier Redis cache |
| `logistics.service.ts` | Carrier dispatch | Singleton — Multi-carrier action dispatching (Shiprocket, Delhivery, Blue Dart, Xpressbees, Shadowfax, Ecom Express, DTDC, ClickPost, Custom) for reattempts, address updates, RTO arrest, COD adjustments, and safe webhook-only mode handling |
| `meta-embedded-signup.service.ts` | Meta signup | Instance — WhatsApp Cloud API embedded signup flow |
| `meta-template.service.ts` | Template management | Instance — register/update Meta templates |
| `metrics.service.ts` | Performance metrics | Instance — rescue rates, cohort aggregates, Phase 4 readiness |
| `payment.service.ts` | Payment processing | Singleton — Razorpay/Cashfree link generation and verification |
| `payment-connect.service.ts` | Gateway connection | Instance — credential validation and encrypted storage |
| `carrier-connect.service.ts` | Carrier connection | Instance — Multi-carrier credential validation, encrypted storage in `merchant.carrierConfig.carriers`, dual-mode (Direct API vs Webhook-Only), and universal webhook URL generation |
| `realtime.service.ts` | SSE hub | Singleton (EventEmitter) — broadcasts to merchant dashboards |
| `rescue-matching.service.ts` | Multi-order disambiguation | Singleton — Redis candidate snapshots for ambiguous replies |
| `rto-arrest.service.ts` | RTO arrest | Singleton — intercepts `rto_initiated` for last-chance rescue, carrier abort override with automated `rtoFeeSaved` and `NdrCase` attribution |
| `rto-risk.service.ts` | AI predictive RTO risk | Singleton — multi-factor scoring (phone, address, pincode, order value) |
| `sandbox.service.ts` | Test simulation | Instance — simulated NDR, test pulse, graduation gate |
| `security-alert.service.ts` | Security alerts | Static — Slack/Discord IDOR and circuit breaker notifications |
| `shopify-oauth.service.ts` | Shopify OAuth | Instance — OAuth URL generation, callback, nonce validation |
| `subscription.service.ts` | SaaS billing | Instance — Razorpay subscriptions, plan provisioning, quota enforcement |
| `whatsapp.service.ts` | WhatsApp API | Singleton — Meta Cloud API v22.0 message sending |
| `whatsapp-cost.service.ts` | Cost classifier | Functional — marketing (~₹0.88) vs utility (~₹0.14) classification |
| `woocommerce-connect.service.ts` | WooCommerce | Instance — store connection via Consumer Key/Secret |
| `alert.service.ts` | System alerts | Instance — quality warnings, template rejections, billing alerts |
| `merchant-digest.service.ts` | Hourly digest | Singleton — batches real-time operational events into hourly merchant emails |

## Subdirectories

| Directory | Role |
|-----------|------|
| `analytics/` | `roi-calculator.service.ts` — weekly report metrics, freight savings, causal holdout |
| `courier/` | `cod-adjustment.service.ts` (doorstep COD balance), `shipment-status.map.ts` (status normalization) |
| `state-machine/` | `order-state-machine.service.ts` — legal transitions, stale webhook rejection, terminal guards |
| `whatsapp/` | `whatsapp-dispatcher.service.ts` (rate limiting, cooldowns, credits), `template-mapper.service.ts` (template selection) |

## Key Invariants

- Services using DB MUST scope all queries to `merchantId`
- `encryption.service.ts` MUST be used for ALL third-party credential storage
- `whatsapp-dispatcher` enforces 4-hour cooldown, 3-attempt maximum caps
- `order-state-machine` MUST reject stale out-of-order webhook timestamps
- `whatsapp-cost.service.ts` MUST classify before sending to prevent marketing-rate traps
- Singleton services use `getInstance()` pattern
- **Prepaid Remark Sanitization**: If courier webhook reports `COD_COLLECTION_ISSUE` on a prepaid parcel, the engine MUST sanitize the category to `CUSTOMER_NOT_AVAILABLE` before template mapping to prevent sending COD payment links.
- **Financial Attribution Invariant**: Rescheduled deliveries, address corrections, and RTO arrests MUST populate `order.rtoFeeSaved` and `NdrCase.estimatedLossPrevented` with merchant's `estimatedRtoLossPerOrder` (default ₹140) to drive accurate dashboard ROI metrics.

## Agent Cheat Sheet

- To add a new service: Create `yourservice.service.ts`, use singleton pattern, import in consuming api/job
- To add carrier support: Add dispatch logic in `logistics.service.ts`, add status map in `courier/shipment-status.map.ts`, create webhook route in `webhooks/`, and register in `Order.carrier` and `Merchant.carrierConfig`
- To modify state transitions: Edit `state-machine/order-state-machine.service.ts`
