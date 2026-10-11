# Changelog

All notable changes to the RescueShip platform are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-10-11

### 🚀 Major Release: Merchant Command Deck & Zero-Fake Operational Engine

#### Added
- **Zone 0 — System Health Ribbon**: Sticky operational status monitor tracking Meta WhatsApp Business API tier message quota (`current24hCount` / `metaTierLimit`), WABA quality dot (`Healthy`, `Warning`, `Throttled`), and BullMQ Dead Letter Queue (DLQ) anomalous job counter with WCAG 2.1 AA accessible progressbar labeling.
- **Zone 1 — Financial Intelligence Grid**: Live financial KPIs reflecting verified recoveries (`Net Saved`, `Rescue Rate`, `COD→Prepaid Conversion`, and `ROI Multiple`), sourcing directly from the backend financial analytics service without synthetic multipliers.
- **Zone 2 — Smart Action Queue**:
  - Live carrier SLA countdown timers adhering to Indian logistics operational standards (48-hour deadline for Delhivery, 24-hour deadline for other carriers like Shiprocket, Bluedart, etc.).
  - Truthful fallback state: un-scanned consignments display "Awaiting scan" rather than simulated clocks.
  - Power-user keyboard navigation: `/` focuses search, `j`/`k` moves through order rows, `Enter` opens drawer triage, and `Escape` closes the drawer.
  - Strict WCAG 2.4.3 focus management returning focus to the initiating row upon dismissal.
  - Background tick throttling with instant tab reactivation via `document.visibilitychange`.
- **Zone 3 — Recovery Analytics & Funnel**:
  - Recharts integration powered by ISO calendar week bucketing (`bucketRoiRecordsByWeek`), preventing flat quarter splits or epoch-week ("W1 1970") distortions.
  - Direct visualization of `RescueFunnel` telemetry across NDR detection, WhatsApp contact, customer response, and successful delivery.
  - Honest empty state: renders clear zero-data guidance when no historical shipments exist instead of synthetic sine waves.
- **Zone 4 — Courier Intel & Fraud Dispute Watchtower**:
  - Carrier performance metrics derived from real delivery attempts and RTO rates.
  - Detection and dispute verification for fake courier delivery remarks with merchant evidence logs.
- **Zone 5 — Pre-Dispatch Predictive RTO Watchtower**:
  - High-risk order triage table backed by real-time risk assessment (`Order.find({ 'rtoRisk.level': 'HIGH' })`).
  - Native mutation endpoints (`POST /api/orders/:orderId/risk-action`) supporting `manual_review_approve`, `whatsapp_verify`, and `require_deposit` with full tenant isolation and audit logging.
- **Zone 6 — Geographic Risk Heatmap**:
  - Real-time high-risk pincode aggregation with direct integration to Shopify and WooCommerce pincode restriction sync.
- **Triage Slide-Over Drawer**:
  - WhatsApp conversation transcripts, delivery attempt history, and address correction actions with AI confidence badges derived from actual Gemini address parser output.
- **Design System & Performance**:
  - CSS custom properties strictly aliased to core semantic tokens (`--rose`, `--indigo`, `--emerald`), ensuring 0 undefined token warnings.
  - CSS `content-visibility: auto` containment applied to offscreen analytical sections for instant paint times.
- **Test Suite Hardening**:
  - 11 new backend Jest integration tests in `tests/dashboard-and-risk-actions.test.ts` bringing the test suite to 426/426 passing tests across 50 suites.
  - 19/19 passing Vitest unit specs and 72/72 passing Playwright end-to-end and accessibility specs.

#### Changed
- Dynamic dashboard hero title now dynamically tracks active date preset (`Today`, `Last 7 Days`, `Last 30 Days`, `This Month`).
- Backend `GET /api/dashboard/summary` accepts ISO `startDate` and `endDate` query parameters for precise interval reporting.

#### Removed
- Removed hardcoded synthetic placeholder charts (`Week 1–4 × ₹350,000`).
- Removed synthetic mock carrier lists and hardcoded demo order arrays from dashboard views.
- Removed fake remark fallback (`|| 0.85`), displaying honest "Flagged" states when confidence is pending.
