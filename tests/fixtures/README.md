# tests/fixtures/

> **Purpose**: Static JSON mock fixtures representing real-world courier webhook payloads and delivery reports.

## File Catalog

| File | Purpose |
|------|---------|
| `shiprocket.ndr.mock.json` | Sample Shiprocket delivery failure / RTO initiation webhook payload used in mock tests. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `tests/shiprocket.parser.test.ts` | Jest | `PASS` ✅ | Validates Shiprocket payload parsing and status normalization |
