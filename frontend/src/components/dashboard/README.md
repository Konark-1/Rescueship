# frontend/src/components/dashboard/

> **Purpose**: Dashboard command center components — telemetry ribbons, smart triage queues, financial grids, drawer inspectors, and Recharts trends.

## File Catalog

| Component | Role |
| :--- | :--- |
| `ActionQueue.tsx` | Real-time smart action queue with 24/48h SLA clocks, urgency bucketing, keyboard triage shortcuts (`/`, `j`/`k`, `Enter`, `Esc`), and quick action buttons. |
| `AttentionPanel.tsx` | High-priority attention banner for urgent NDR incidents and operational blocks. |
| `CarrierPerformanceCard.tsx` | Performance scorecards for Shiprocket, Delhivery, Blue Dart, and other connected couriers. |
| `DateRangePicker.tsx` | Telemetry date filter selector for analytics charts. |
| `FinancialGrid.tsx` | Live financial ROI counters (revenue saved, RTO fees arrested, conversion ratios). |
| `OrderDrawer.tsx` | WCAG 2.4.3 compliant sliding drawer with detailed order timeline, AI address corrections, and customer WhatsApp audit. |
| `RtoWatchtower.tsx` | Pre-dispatch and in-transit RTO risk watchtower with high-risk pincode radar. |
| `SystemHealthRibbon.tsx` | Health ribbon for WABA quality rating, Meta 24h tier utilization, and BullMQ DLQ counts. |
| `TrendCharts.tsx` | Recharts visualizations for NDR detection volume, recovery rates, and delivery trends. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/sla-and-bucketing.test.ts` | Vitest | `PASS` ✅ | 24/48h SLA timers, urgency bucketing, and pre-dispatch action queue ordering |
| `frontend/tests/dashboard-analytics.spec.ts` | Playwright | `PASS` ✅ | Financial grids, date range filters, and carrier matrix rendering |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Keyboard navigation, focus trapping, and accessibility scans across dashboard |
