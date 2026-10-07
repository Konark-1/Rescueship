# workers/

> **Purpose**: Dedicated standalone worker entrypoints for running BullMQ background queue processors in isolated processes or micro-services.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `escalation-worker.ts` | Standalone escalation worker | `runEscalationWorker()` — standalone consumer for `escalation` BullMQ queue |
| `carrier-dispatch.worker.ts` | Carrier dispatch & DLQ worker | `carrierDispatchWorker`, `carrierDlqWorker`, `carrierDispatchQueue`, `processCarrierJob()` — handles outbound logistics updates and 429 rate limit backoffs |

## Architecture & Deployment

In monolithic deployments (single Render Web Service or single container), workers run inline inside Express `src/index.ts` via `startAllWorkers()`.

In distributed or scaled production deployments (Render Background Worker, Docker Compose, Kubernetes):
1. **Full Worker Fleet**: Run `npm run worker` (`src/worker.ts`), which connects DB/Redis and boots all 11 BullMQ workers and cron schedulers with zero HTTP overhead.
2. **Micro-Worker Isolation**: Run `npx ts-node src/workers/escalation-worker.ts` to dedicate resources strictly to NDR multi-tier escalation jobs.
3. Set `DISABLE_INLINE_WORKERS=true` on the web service so the API only handles HTTP traffic.
