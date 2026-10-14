# hooks/

> **Purpose**: Custom React hooks — smooth scrolling, magnetic interactions, real-time SSE, and scroll animations.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `useDashboardSSE.ts` | Real-time dashboard telemetry | `useDashboardSSE(token)` — dynamic subscription to live order and rescue streams |
| `useFinancialROI.ts` | Financial ROI calculations | `useFinancialROI()` — computes direct freight savings and merchant ROI multipliers |
| `useFraudIndex.ts` | Anti-fraud risk indexing | `useFraudIndex()` — high-risk order risk telemetry & score categorizations |
| `useLenis.ts` | Smooth scrolling | `useLenis()` — Lenis with inertial wheel, anchor intercepts, respects `prefers-reduced-motion` |
| `useMagnetic.ts` | Magnetic interaction | `useMagnetic(strength?)` — mouse move/leave callbacks for magnetic attraction |
| `useMerchantPlatform.ts` | Storefront platform detection | `useMerchantPlatform()` — queries active store platform (Shopify / WooCommerce / Custom) |
| `useRealtime.ts` | SSE stream | `useRealtime(token, options, enabled?)` — resilient EventSource to `/api/realtime/stream`, auto-reconnect (5 retries) |
| `useRescueFunnel.ts` | NDR rescue funnel metrics | `useRescueFunnel()` — multi-stage funnel statistics (NDR -> Contacted -> Converted) |
| `useScrollAnimations.ts` | Stub | `useScrollAnimations()` — returns null, reserved for legacy bindings |

## Key Invariants

- `useRealtime` caps at 5 reconnection attempts before giving up
- `useRealtime` events: `order_update`, `ndr_detected`, `ndr_rescued`, `payment_received`, `capacity_warning`, `stats_refresh`
- `useLenis` respects `prefers-reduced-motion` media query
