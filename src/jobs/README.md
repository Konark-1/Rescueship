# jobs/

> **Purpose**: BullMQ background workers and cron schedulers — async job processing for COD conversion, NDR rescue, escalation, reconciliation, and reporting.

## File Catalog

| File | Queue Name | Schedule | Role |
|------|-----------|----------|------|
| `index.ts` | — | — | Master orchestrator: `startAllWorkers()`, `stopAllWorkers()` |
| `codConversion.job.ts` | `cod-conversion` | Event-driven | COD discount + payment link + WhatsApp dispatch |
| `codConversion.worker.ts` | — | — | Proxy re-export of codConversion.job |
| `ndrRescue.job.ts` | `ndr-rescue` | Event-driven | NDR policy eval + NdrCase creation + rescue messages |
| `escalation.job.ts` | `escalation` | Delayed (4h/12h/24h) | Multi-tier follow-up escalation |
| `ndr-lifecycle.job.ts` | `ndr-lifecycle` | `*/15 * * * *` + `0 0 * * *` | 15-min reminder sweep + 72h auto-expiry |
| `weeklyRoiReport.job.ts` | `weekly-roi-report` | `0 9 * * 0` (Sun 9AM) | Weekly WhatsApp ROI summary to merchant |
| `monthlyReset.job.ts` | `monthly-orders-reset` | `0 0 1 * *` (1st midnight) | Reset `currentMonthOrders` across all merchants |
| `reconciliation.job.ts` | `reconciliation` | `0 3 * * *` (3AM daily) | Carrier outcome vs RescueLedger reconciliation |
| `quality-monitor.job.ts` | `quality-monitor` | On-demand | Meta WABA quality rating checker |
| `template-poller.job.ts` | `template-poller` | Delay-based | Meta template approval status polling |
| `whatsappSend.job.ts` | `whatsapp-send` | Event-driven | High-throughput outbound WhatsApp (70 msg/s rate limit) |
| `deadLetter.job.ts` | `dead-letter` | Receives failed | Permanently failed job forensics |

## Key Invariants

- ALL workers MUST check `merchant.settings.globalPause` before dispatching
- ALL workers MUST use `TenantCircuitBreaker` to halt on repeated 401s
- `whatsappSend` rate limited to 70 messages per 1000ms
- `ndr-lifecycle` cancels pending jobs when customer responds (`cancelJobsByOrderId`)
- `monthlyReset` resets billing counters — must run exactly once per month
- All cron schedules registered in `index.ts` → `startAllWorkers()`

## Agent Cheat Sheet

- To add a new worker: Create `yourworker.job.ts`, export worker, import in `index.ts`, add to `startAllWorkers()`
- To add a new cron: Use `queue.upsertJobScheduler(id, { pattern: 'cron' })` pattern
- To debug failed jobs: Check `dead-letter` queue logs
- Custom job IDs: Use `makeJobId()` from `../utils/job-id` (no colons allowed in BullMQ job IDs)
