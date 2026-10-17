# 🎨 RescueShip Design System (DESIGN.md)

> **Neutomni Hybrid Contrast & Fluent Motion Edition**
> Single source of truth derived from `frontend/src/index.css`, `frontend/src/lib/motion.ts`, and `frontend/src/pages/landing.css`.
> Last Updated: 2026-10-17

---

## 1. Aesthetic Vision & Brand Archetype
- **Concept:** Neutomni-Inspired Hybrid Contrast Architecture fusing High-Precision Obsidian Mission Control with Warm Editorial Alabaster Paper.
- **Mood:** Tactile, mathematical, editorial, and industrial. Every metric feels audit-grade; every transition feels spring-driven, tactile, and physical.
- **Core Metaphors:**
  1. **Tactile Courier Waybill / Ticket Metaphor:** Perforated thermal waybill tickets with `✂ TEAR ALONG LINE` dashed red dividers, monospace serial badges (`RS/PASS.01`, `RS/PKG.01-RES`, `RS/SIM.01`), and interactive scissors.
  2. **Visual Equations & Directional Flows:** Mathematical arithmetic ribbons (`CAC ₹230 + Forward ₹80 + Reverse ₹80 + Repack ₹40 = ₹430 Bleed`) and laser-guided A → B directional intercept paths.
  3. **Desktop OS / File Window Chrome:** Tabular intelligence styled as `pincode_watchtower.csv` and expandable documentation styled as a line-numbered `FAQ.md` markdown workspace.

---

## 2. Canvas & Surface Hierarchy

### A. Obsidian Mission Control Chapters (`.lp-chapter--dark`)
| Token | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `--bg-void` | `#050508` | Deep void root canvas background |
| `--bg-deep` | `#0a0a10` | Secondary surface background |
| `--bg-surface` | `#0d0f15` | Elevated dark card and pricing ticket surface |
| `--bg-card` | `rgba(255,255,255,0.03)` | Frosted telemetry and terminal containers |
| `--border` | `rgba(255,255,255,0.06)` | Exposed 1px Swiss structural grid border |
| `--border-hover` | `rgba(255,255,255,0.12)` | Interactive card hover outline |

### B. Warm Editorial Paper Chapters (`.lp-chapter--paper`)
| Token | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `--bg-paper` | `#f6f4ee` | Warm alabaster editorial chapter canvas |
| `--bg-paper-elevated` | `#ffffff` | Elevated paper card, CSV table, and FAQ window |
| `--bg-paper-subtle` | `#ebe7dc` | Gutter, window title bar, and table header fill |
| `--bg-paper-tint` | `rgba(17,18,22,0.035)` | Subtle paper drop-shadow tone |
| `--border-paper` | `rgba(17,18,22,0.12)` | Exposed 1px Swiss hairline border on paper |
| `--border-paper-strong` | `rgba(17,18,22,0.24)` | High-emphasis paper boundary and open accordion stroke |

---

## 3. Brand & Status Palette (WCAG 2.1 AA Compliant)

| Token | Value | Role |
| :--- | :--- | :--- |
| `--indigo` | `#4f46e5` | Primary brand accent & high-priority CTAs |
| `--indigo-soft` | `#818cf8` | Secondary interactive highlights & prefixes |
| `--emerald` | `#10b981` | Successful order rescues, recovered revenue |
| `--amber` | `#f59e0b` | Warnings, pending attempts, delayed delivery states |
| `--rose` | `#f43f5e` | Intercepted NDR alerts, failed delivery remarks |
| `--waybill-red` | `#b91c1c` | Physical courier waybill stamp red on paper (6:1 contrast) |
| `--waybill-red-dark` | `#f87171` | High-visibility waybill red on dark canvas (6.6:1 contrast) |
| `--waybill-emerald` | `#065f46` | Editorial deep forest green on paper (6.25:1 contrast) |
| `--waybill-indigo` | `#3730a3` | Deep editorial indigo for icons and hashes on paper (8.75:1 contrast) |
| `--waybill-amber` | `#92400e` | Deep editorial amber for warnings on paper (5.8:1 contrast) |

---

## 4. Typography & Foreground Tokens

| Token | Value | Hierarchy / Contrast |
| :--- | :--- | :--- |
| `--text-1` | `#f4f4f5` | Dark canvas high-emphasis headings & titles |
| `--text-2` | `#d4d4d8` | Dark canvas body & telemetry (10:1 contrast) |
| `--text-3` | `#9ca3af` | Dark canvas muted captions, timestamps, labels |
| `--text-paper-1` | `#111216` | Paper canvas high-emphasis headings & titles (16.8:1 contrast) |
| `--text-paper-2` | `#383b43` | Paper canvas body, descriptions, table cells (9.8:1 contrast) |
| `--text-paper-3` | `#5e626e` | Paper canvas captions, indices, file tags (5.4:1 contrast) |
| `--font-body` | `'Inter', sans-serif` | General interface & body typography |
| `--font-display` | `'Space Grotesk', sans-serif` | Hero headings & statement typography |
| `--font-mono` | `'JetBrains Mono', monospace` | Telemetry logs, AWBs, order IDs, currency, equations |

---

## 5. Fluent Motion & Spring Physics Architecture

Derived from `frontend/src/lib/motion.ts` and `motion/react` v12:

### Spring Physics Presets
```ts
// 1. springDefault: Natural, tactile response for interactive cards & dialogs
export const springDefault = { type: 'spring', stiffness: 280, damping: 28, mass: 0.8 };

// 2. springSnappy: Rapid response for toggles, tabs, chips, and quick-replies
export const springSnappy = { type: 'spring', stiffness: 400, damping: 32, mass: 0.6 };

// 3. springBouncy: Energetic response for success badges & conversion counters
export const springBouncy = { type: 'spring', stiffness: 320, damping: 18, mass: 0.9 };

// 4. springScroll: Inertial dampening for scroll-linked telemetry reel & nav progress
export const springScroll = { stiffness: 140, damping: 26, restDelta: 0.001 };
```

### Micro-Interactions
1. **SpotlightCard 3D Micro-Perspective:**
   Mouse movement relative to card center computes subtle `rotateX` (±2.2deg) and `rotateY` (±2.2deg) with a 420px radial cursor follow glow. Automatically disabled under `prefers-reduced-motion: reduce`.
2. **Waybill Scissors Interaction:**
   Hovering over any courier waybill card rotates and slides the `✂` scissors indicator (`transform: translateX(6px) rotate(-8deg)`).
3. **Interactive `< DRAG TO INTERCEPT >` Gate:**
   Allows the user to physically drag a spring-bound slider across the track to simulate an instant WhatsApp NDR rescue.
4. **Laser Progress Bar:**
   `StickyNav` features a spring-smoothed laser progress hairline tracking `scrollYProgress` with zero layout jitter.

---

## 6. Accessibility & Testing Guardrails

1. **Strict Stylelint Variable Enforcement:**
   Every CSS property ending in `color` must reference a CSS custom property `var(--...)`. Raw hex outside `:root` is strictly prohibited.
2. **Root Canvas Invariant:**
   `.lp` maintains `background: var(--bg-void)` (`#050508`). Light paper chapters are scoped via `<div className="lp-chapter lp-chapter--paper">`.
3. **Motion Accessibility (Instant Settlement):**
   When `prefers-reduced-motion: reduce` is detected:
   - Hero elements pass `initial={false}` and settle within 1 animation frame (< 30ms).
   - Spring interpolation on `.lp-reel` is bypassed.
   - Background grid pulses and cursor blinks are disabled via CSS.
4. **Dual-Theme Contrast Validation:**
   Both dark `#050508` and light `#f6f4ee` chapters maintain >= 4.5:1 WCAG 2.1 AA color contrast across all badges, tables, and waybill tickets. Tested via `@axe-core/playwright`.
