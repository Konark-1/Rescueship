# i18n/

> **Purpose**: Localization and customer-facing copy governance — centralized message strings enforcing non-accusatory tone.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `customer-copy.ts` | Copy dictionary | `COPY_STRINGS: string[]`, `COPY` object with interpolation helpers (`verifyInitial`, `unusualStatus`, `askLocationPin`, `cancelled`, etc.) |
| `messages.ts` | Message templates | `getMessages(lang)`, `translateReason(reason, lang)`, `MESSAGES` catalog |

## Architecture & Data Flow

`customer-copy.ts` provides verified non-accusatory copy scanned by `../utils/customer-copy-guard.ts` at build time. `messages.ts` provides WhatsApp template generators consumed by `../services/whatsapp/whatsapp-dispatcher.service.ts`.

## Key Invariants

- NEVER use accusatory language about couriers ("lied", "never came", "fraud") — enforced by `customer-copy-guard.ts`
- All customer-facing text MUST go through `COPY` helpers, not inline strings
- `translateReason()` maps carrier codes to human-readable text — keep in sync with `../config/rescue-policy.ts`

## Agent Cheat Sheet

- To add a new customer message: Add method to `COPY` object, add string to `COPY_STRINGS`, run copy guard scan
- To add Hindi support: Add Hindi variants alongside English in `messages.ts`
- To add a new NDR reason: Add case in `translateReason()`
