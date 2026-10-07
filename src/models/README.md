# models/

> **Purpose**: MongoDB Mongoose schemas — 12 data models with compound indexes, TTL rules, and immutable audit hooks.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `index.ts` | Barrel export | Re-exports all 12 models |
| `indexes.ts` | Index definitions | Compound, partial unique, and TTL index setup for all collections |
| `Merchant.ts` | Tenant profile | `Merchant` model — credentials vault, multi-carrier configuration (`carrierConfig.carriers` for all 8 carriers + custom), billing, settings, `metaTierLimit` (24h Meta API throttling), quality stats |
| `Order.ts` | Order ledger | `Order` model — status, universal payment support (`paymentMethod: 'cod' | 'prepaid'`), carrier enum (Shiprocket, Delhivery, Blue Dart, Xpressbees, Shadowfax, Ecom Express, DTDC, ClickPost, Custom), AWB, `rtoFeeSaved` financial metric, payment links, address updates |
| `NdrCase.ts` | NDR tracker | `NdrCase` model — failure classification & category sanitization, customer response, carrier sync, `rtoFeeSaved` & `estimatedLossPrevented` ROI metrics |
| `RescueLedger.ts` | Attribution ledger | `RescueLedger` model — append-only, holdout outcomes, fake scores, Meta costs |
| `Shipment.ts` | Package status | `Shipment` model — AWB tracking, COD amendment history |
| `AuditLog.ts` | SOC-2 audit trail | `AuditLog` model — immutable, 90-day TTL, pre-hooks block updates/deletes |
| `MessageLog.ts` | WhatsApp log | `MessageLog` model — wamid tracking, delivery status callbacks |
| `DeliveryAttempt.ts` | Delivery scans | `DeliveryAttempt` model — raw carrier payloads, fake remark evaluations, `carrier`, `carrierScanCode`, `scanTimestamp`, compound unique index `idx_unique_carrier_scan` |
| `ProcessedPayment.ts` | Idempotency | `ProcessedPayment` model — deduplicated payment replay guard |
| `BillingEvent.ts` | Billing ledger | `BillingEvent` model — credit deductions, plan changes |
| `WebhookEvent.ts` | Webhook dedup | `WebhookEvent` model — raw webhook deduplication log |
| `WhatsAppTemplate.ts` | Template catalog | `WhatsAppTemplate` model — Meta template registry per merchant |

## Key Invariants

- Unique index: `{ merchantId: 1, externalOrderId: 1 }` on Order — prevents duplicate ingestion
- Partial unique: `{ merchantId: 1, awb: 1 }` on Order — non-null AWB strings only
- Sparse unique: `{ awb: 1, carrier: 1, carrierScanCode: 1, scanTimestamp: 1 }` on DeliveryAttempt (`idx_unique_carrier_scan`) — deduplicates delayed retry scans (MongoDB 11000)
- `AuditLog` pre-hooks BLOCK `updateOne`, `updateMany`, `deleteOne`, `deleteMany` — immutable
- `AuditLog` TTL: 90 days (7,776,000 seconds)
- `RescueLedger` is append-only, no TTL — permanent attribution record
- ALL queries MUST include `merchantId` in filter (tenant isolation)

## Agent Cheat Sheet

- To add a new model: Create `ModelName.ts`, add to `index.ts` barrel, add indexes in `indexes.ts`
- To add an index: Add to `indexes.ts`, NOT inline in schema definition
- To query orders: Always filter `{ merchantId, ... }` — never query without tenant scope
