# templates/

> **Purpose**: Meta WhatsApp Cloud API message template JSON payloads — pre-approved templates for COD conversion and NDR rescue.

## File Catalog

| File | Template Name | Language | Category | Buttons |
|------|--------------|----------|----------|---------|
| `cod_conversion_en.json` | `cod_conversion_en` | `en` | UTILITY | `Pay Now` (dynamic URL) |
| `cod_conversion_hi.json` | `cod_conversion_hi` | `hi` | UTILITY | `अभी भुगतान करें` (dynamic URL) |
| `ndr_rescue_en.json` | `ndr_rescue_en` | `en` | UTILITY | `Reschedule Tomorrow`, `Update My Address`, `Cancel Order` |
| `ndr_rescue_hi.json` | `ndr_rescue_hi` | `hi` | UTILITY | `कल के लिए शेड्यूल करें`, `पता बदलें`, `ऑर्डर रद्द करें` |

## Key Invariants

- All templates MUST be category UTILITY (not MARKETING) to maintain ~₹0.14 cost vs ~₹0.88
- Template names must match `../services/whatsapp/template-mapper.service.ts` mapping
- Templates must be approved by Meta before use — check via `/api/connect/whatsapp/templates/status`
- COD templates use 5 variables: customer name, order ID, price, discount, payment URL
- NDR templates use 3 variables: customer name, order ID, failure reason
