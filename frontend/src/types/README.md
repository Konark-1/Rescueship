# frontend/src/types/

> **Purpose**: TypeScript ambient type and interface definitions for frontend components, dashboard models, and analytics telemetry.

## File Catalog

| File | Role |
|------|------|
| `dashboard.d.ts` | Type definitions for `UnifiedDashboardOrder`, `OrderStatus`, `StorePlatform`, and `SystemHealthData` (WABA health, Meta Tier limits, DLQ counts). |
| `analytics.d.ts` | Ambient telemetry types for conversion metrics, recovery rates, and RTO risk levels. |

## Key Invariants

- Must mirror the domain states defined across backend models (`src/models/Order.ts`, `src/types/index.ts`).
- Enforces strict discriminated union typing for order lifecycle states.

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/sla-and-bucketing.test.ts` | Vitest | `PASS` ✅ | Validates `UnifiedDashboardOrder` typing, status values, and SLA bucketing logic |
| `frontend/tests/realtime-state.test.ts` | Vitest | `PASS` ✅ | Validates typed order ingestion into reactive Zustand stores |
