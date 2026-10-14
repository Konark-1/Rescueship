# frontend/src/store/

> **Purpose**: Client-side reactive state management powered by Zustand — handles real-time order lists, telemetry counters, and optimistic updates.

## File Catalog

| File | Role |
|------|------|
| `OrderStore.ts` | Zustand store (`useOrderStore`) managing loaded orders, status updates, live metric counters (`activeNdrCases`, `revenueSaved`, `totalConversions`), and SSE live push integration. |

## Key Invariants

- Order matching supports `_id`, `id`, `externalOrderId`, and `orderId` identifiers.
- Live metrics prevent negative counter values (`Math.max(0, val)`).

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/realtime-state.test.ts` | Vitest | `PASS` ✅ | OrderStore creation, optimistic updates, metric increments, and SSE event streaming (11 tests) |
