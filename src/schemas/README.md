# schemas/

> **Purpose**: Zod validation schemas for inbound webhook payloads.

## File Catalog

| File | Key Exports |
|------|-------------|
| `webhook.schemas.ts` | `ShiprocketWebhookSchema`, `WhatsAppInboundMessageSchema`, `RazorpayPaymentWebhookSchema`, `ShopifyOrderWebhookSchema` |

## Architecture & Data Flow

Schemas are consumed by `../webhooks/*.webhook.ts` via `validateBody()` middleware from `../middleware/validateRequest.ts`.

## Agent Cheat Sheet

- To validate a new webhook source: Add a Zod schema here, apply `validateBody(schema)` middleware in the webhook handler
