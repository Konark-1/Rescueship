# courier/

> **Purpose**: Carrier integration layer — doorstep COD adjustment and shipment status normalization.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `cod-adjustment.service.ts` | COD balance modification | `CodAdjustmentService` singleton — `adjustCodAmount(params)`. Idempotent. Guards overpayment. Flags `COD_AMENDMENT_MANUAL_REQUIRED` on carrier rejection. |
| `shipment-status.map.ts` | Status normalization | `SHIPROCKET_STATUS_MAP`, `CLICKPOST_STATUS_MAP`, `DELHIVERY_STATUS_MAP`, `normalizeCarrierStatus(carrier, rawStatus, remark)` |

## Key Invariants

- COD adjustment is idempotent — safe to retry
- `COD_AMENDMENT_MANUAL_REQUIRED` flag triggers immediate dashboard alert
- Status maps MUST cover all carrier-specific strings — unmapped statuses logged as warnings
- `normalizeCarrierStatus()` returns `{ status, isNdr, isTerminal }` — consumed by webhook handlers
