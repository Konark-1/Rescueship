# 🎨 RescueShip Design System (DESIGN.md)

> **Auto-Generated Design Specification**
> Single source of truth derived from `frontend/src/index.css`.
> Generated: 2026-08-29T10:34:20.467Z

---

## 1. Aesthetic Vision & Brand Archetype
- **Theme Concept:** Developer Console / Mission Control / Telemetry Terminal
- **Mood:** Precise, high-contrast, atmospheric dark canvas with rich phosphor accents
- **Core Value Proposition:** Autonomous NDR rescue and revenue recovery for D2C brands

---

## 2. Canvas & Surface Hierarchy

| Token | Value | Purpose / Role |
| :--- | :--- | :--- |
| `--bg-void` | `#050508` | Deep space root canvas background |
| `--bg-card` | `rgba(255,255,255,0.03)` | Primary container & dashboard card background |
| `--bg-input` | `#12121a` | Form field and interactive input fill |
| `--border-color` | `rgba(255,255,255,0.08)` | Subtle structural border boundary |
| `--border-hover` | `rgba(255,255,255,0.12)` | Active hover boundary highlight |

---

## 3. Brand & Status Palette (WCAG 2.1 AA Compliant)

| Token | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `--indigo` | `#4f46e5` | Primary brand accent & high-priority CTAs |
| `--indigo-soft` | `#818cf8` | Secondary interactive highlights & prefixes |
| `--emerald` | `#10b981` | Successful order rescues, recovered revenue, online status |
| `--amber` | `#f59e0b` | Warnings, pending attempts, delayed delivery states |
| `--rose` | `#f43f5e` | Intercepted NDR alerts, failed delivery remarks |
| `--danger` | `#ef4444` | Critical errors and cancellation states |

---

## 4. Typography & Foreground Tokens

| Token | Value | Hierarchy / Contrast |
| :--- | :--- | :--- |
| `--text-1` | `#f4f4f5` | Primary high-emphasis headings & titles |
| `--text-2` | `#d4d4d8` | Secondary body text & telemetry feed (10:1 contrast) |
| `--text-3` | `#9ca3af` | Muted captions, timestamps, subtle labels (> 6.8:1 contrast) |
| `--font-body` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | General interface & body typography |
| `--font-display` | `'Space Grotesk', -apple-system, sans-serif` | Hero headings & statement typography |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Telemetry logs, AWBs, order IDs, currency figures |

---

## 5. Spatial System (4px Base Grid)

| Token | Pixel Equivalent | Standard Usage |
| :--- | :--- | :--- |
| `--space-05` | 2px | Micro padding & tight icon alignment |
| `--space-1` | 4px | Inline icon gaps & compact badge padding |
| `--space-2` | 8px | Button inline gaps, input inner spacing |
| `--space-3` | 12px | Card internal element separation |
| `--space-4` | 16px | Standard component padding & layout gutters |
| `--space-6` | 24px | Section gaps & card margins |
| `--space-8` | 32px | Sub-section vertical rhythm |
| `--space-12` | 48px | Page section spacing |
| `--space-16` | 64px | Hero container vertical breathing room |

---

## 6. Radius Scale

| Token | Value | Component Application |
| :--- | :--- | :--- |
| `--radius-xs` | `4px` | Small badges, log pills, feed tags |
| `--radius-sm` | `8px` | Inputs, sub-buttons, dropdown items |
| `--radius-md` | `12px` | Primary buttons, alert containers |
| `--radius-lg` | `16px` | Dashboard cards, station panels |
| `--radius-xl` | `20px` | Hero containers, terminal windows |
| `--radius-2xl` | `24px` | Outer modal shells |
| `--radius-full` | `9999px` | Pill badges, round avatar buttons |

---

## 7. Accessibility & Code Standards
1. **WCAG 2.1 AA Compliance:** All foreground text must achieve at least 4.5:1 contrast against its background.
2. **Zero Raw RGBA:** All component CSS must reference CSS variables defined in `index.css`.
3. **Stylelint Enforcement:** CI automatically verifies CSS token compliance via `npm run lint:css`.
4. **Automated E2E:** Visual regressions and Axe accessibility scans are tested via `npm run test:e2e`.
