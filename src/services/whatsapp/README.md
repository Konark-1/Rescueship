# whatsapp/

> **Purpose**: WhatsApp messaging subsystem — template dispatch, rate limiting, and cost classification.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `whatsapp-dispatcher.service.ts` | Outbound engine | `WhatsAppDispatcherService` singleton — `dispatchNdrRescue(options)`. Enforces 4h cooldown, 3-attempt max, atomic credit deduction, quiet hours, opt-outs. |
| `template-mapper.service.ts` | Template selection | `TemplateMapperService` singleton — `getMappingForCategory(category)`, `validateTemplatePayload()`, `buildTemplateComponents()` |

## Key Invariants

- 4-hour cooldown between messages to same phone number
- Maximum 3 WhatsApp attempts per order lifecycle
- Credit check MUST happen BEFORE send — never send without credits
- Template category classification MUST happen before dispatch to avoid marketing-rate trap (~₹0.88 vs ~₹0.14)
- `whatsapp-send` queue rate limited to 70 msg/s

## Agent Cheat Sheet

- To add a new template: Add JSON in `../../templates/`, add mapping in `template-mapper.service.ts`
- To change cooldown: Modify cooldown constant in `whatsapp-dispatcher.service.ts`
- To change rate limit: Modify limiter config in `../../jobs/whatsappSend.job.ts`
