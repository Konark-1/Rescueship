# components/

> **Purpose**: Reusable UI components — layout shells, data visualizations, interactive panels, and feature showcases.

## File Catalog

| File | Role |
|------|------|
| `AppLayout.tsx` + `AppLayout.css` | Console navigation shell — sidebar, header, mobile drawer |
| `AuthLayout.tsx` | Two-column auth shell — narrative terminal + glassmorphism form |
| `AiAddressDecoder.tsx` | Interactive demo of colloquial address → geocoded output |
| `CarrierMarquee.tsx` | Infinite horizontal ticker of supported integrations |
| `ExportButton.tsx` | Plan-gated CSV/JSON export trigger (Scale+ only) |
| `PricingComparisonModal.tsx` | Full plan comparison matrix modal |
| `RescueMetrics.tsx` + `rescue-metrics.css` | Live NDR rescue telemetry card |
| `SetupGuide.tsx` + `setup-guide.css` | Slide-over onboarding checklist |
| `SpotlightCard.tsx` | Cursor-following radial gradient container |
| `TelemetryDrawer.tsx` | Forensic audit drawer with pipeline stage visualization |

## Subdirectories

| Directory | Role |
|-----------|------|
| `icons/` | 7 custom SVG icon components |
| `motion/` | 10 Framer Motion animation primitives |
| `story/` | 3 interactive scroll-linked story scenes |

## Key Invariants

- NO inline `style={{}}` — use CSS modules/stylesheets
- NO raw SVG blocks in page components — extract to `icons/`
- ALL form inputs need `aria-label` or `<label>`
- `ExportButton` checks server-authoritative plan tier, not client state
