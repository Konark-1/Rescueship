# frontend/src/components/audit/

> **Purpose**: SOC-2 compliant immutable audit trail viewer components.

## File Catalog

| Component | Role |
| :--- | :--- |
| `AuditLogViewer.tsx` | Interactive audit log table with filter-by-actor, event severity filtering, raw payload JSON inspection, and copyable trace IDs. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `tests/audit-trail.test.ts` | Jest | `PASS` ✅ | Backend audit trail immutability and event generation |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Audit log route rendering, search interaction, and JSON modal |
