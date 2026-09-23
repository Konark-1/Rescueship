# services/

> **Purpose**: Business logic services — 30 service modules implementing RescueShip's core COD rescue, NDR processing, carrier integration, payments, analytics, and WhatsApp automation.

## File Catalog

| File | Role | Pattern |
|------|------|---------|
| `ndr.service.ts` | Central NDR pipeline | Singleton — remark classification, fake scoring, policy eval, customer response processing |
| `order.service.ts` | COD conversion | Singleton — payment link creation, UPI QR, Shopify/WooCommerce ledger updates |
| `address-correction.service.ts` | 3-mode address engine | Singleton — Nominatim geocoding, Gemini AI parsing, carrier sync |
| `ai.service.ts` | AI chat service | Singleton — external AI API wrapper |
| `gemini.service.ts` | Gemini AI parser | Singleton — colloquial Indian address extraction via Gemini 2.5 Flash |
| `analytics.service.ts` | Dashboard analytics | Singleton — `getDashboardData()`, conversions, carrier performance |
| `email.service.ts` | Email delivery | Singleton — Gmail OAuth2 REST + SMTP fallback |
| `encryption.service.ts` | AES-256-GCM | Singleton — `encrypt()`, `decrypt()`, supports legacy formats |
| `export.service.ts` | Data export | Singleton — CSV/JSON with formula injection sanitization |
| `feature-flags.service.ts` | Feature flags | Instance — PLG readiness check |
| `geocoding.service.ts` | Reverse geocoding | Singleton — OpenStreetMap Nominatim |
| `logistics.service.ts` | Carrier dispatch | Singleton — Shiprocket/Delhivery/ClickPost reattempt, address update, COD adjust |
| `meta-embedded-signup.service.ts` | Meta signup | Instance — WhatsApp Cloud API embedded signup flow |
| `meta-template.service.ts` | Template management | Instance — register/update Meta templates |
| `metrics.service.ts` | Performance metrics | Instance — rescue rates, cohort aggregates, Phase 4 readiness |
| `payment.service.ts` | Payment processing | Singleton — Razorpay/Cashfree link generation and verification |
| `payment-connect.service.ts` | Gateway connection | Instance — credential validation and encrypted storage |
| `carrier-connect.service.ts` | Carrier connection | Instance — credential validation, webhook URL generation |
| `qr-whatsapp.service.ts` | QR generation | Singleton — UPI QR code image for WhatsApp media |
| `realtime.service.ts` | SSE hub | Singleton (EventEmitter) — broadcasts to merchant dashboards |
| `rescue-matching.service.ts` | Multi-order disambiguation | Singleton — Redis candidate snapshots for ambiguous replies |
| `rto-arrest.service.ts` | RTO arrest | Singleton — intercepts `rto_initiated` for last-chance rescue |
| `sandbox.service.ts` | Test simulation | Instance — simulated NDR, test pulse, graduation gate |
| `security-alert.service.ts` | Security alerts | Static — Slack/Discord IDOR and circuit breaker notifications |
| `shopify-oauth.service.ts` | Shopify OAuth | Instance — OAuth URL generation, callback, nonce validation |
| `subscription.service.ts` | SaaS billing | Instance — Razorpay subscriptions, plan provisioning, quota enforcement |
| `whatsapp.service.ts` | WhatsApp API | Singleton — Meta Cloud API v22.0 message sending |
| `whatsapp-cost.service.ts` | Cost classifier | Functional — marketing (~₹0.88) vs utility (~₹0.14) classification |
| `woocommerce-connect.service.ts` | WooCommerce | Instance — store connection via Consumer Key/Secret |
| `alert.service.ts` | System alerts | Instance — quality warnings, template rejections, billing alerts |

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

## Agent Cheat Sheet

- To add a new service: Create `yourservice.service.ts`, use singleton pattern, import in consuming api/job
- To add carrier support: Add case in `logistics.service.ts`, add mapping in `courier/shipment-status.map.ts`
- To modify state transitions: Edit `state-machine/order-state-machine.service.ts`
