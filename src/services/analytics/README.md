# analytics/

> **Purpose**: ROI calculation — weekly report metrics, freight savings formulas, and causal lift holdout analysis.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `roi-calculator.service.ts` | ROI calculator | `RoiCalculatorService` singleton — `getRtoLossPerOrder()`, `getMerchantRoiSummary()`, `getWeeklyReportMetrics()` |

## Architecture & Data Flow

Called by `../../jobs/weeklyRoiReport.job.ts` every Sunday at 9AM. Uses `Order`, `NdrCase`, `RescueLedger`, `Merchant` models. Default RTO loss: ₹140/order (₹70 forward + ₹70 reverse).

## Key Invariants

- Uses `RescueLedger` append-only records for attribution — never mutate ledger entries
- Holdout calculations compare rescue group vs control group outcomes
- `DEFAULT_RTO_LOSS_PER_ORDER = 140` — overridable via `merchant.settings.estimatedRtoLossPerOrder`
