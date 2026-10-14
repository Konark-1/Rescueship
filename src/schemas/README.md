# schemas/

> **Purpose**: Zod validation schemas for inbound webhook payloads.

## File Catalog

| File | Key Exports |
|------|-------------|
| `webhook.schemas.ts` | `ShiprocketWebhookSchema`, `WhatsAppInboundMessageSchema`, `RazorpayPaymentWebhookSchema`, `ShopifyOrderWebhookSchema` |

## Architecture & Data Flow

Schemas are consumed by `../webhooks/*.webhook.ts` via `validateBody()` middleware from `../middleware/validateRequest.ts`.

## Verified Tests & Status

| Test Suite | Tests Covered | Status |
| :--- | :--- | :--- |
| `webhook-security.test.ts` | Zod schema validation, HMAC integrity, and malformed payload rejection | **PASS** (11/11 passed) |
| `anti-exploitation.test.ts` | Schema-level payload sanitization, prototype pollution rejection | **PASS** (15/15 passed) |

## Agent Cheat Sheet

- To validate a new webhook source: Add a Zod schema here, apply `validateBody(schema)` middleware in the webhook handler
