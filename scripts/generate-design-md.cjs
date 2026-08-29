/**
 * RescueShip — Design System Generator
 * Auto-generates DESIGN.md from frontend/src/index.css
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../frontend/src/index.css');
const outputPath = path.resolve(__dirname, '../DESIGN.md');

if (!fs.existsSync(cssPath)) {
  console.error('Error: index.css not found at ' + cssPath);
  process.exit(1);
}

const css = fs.readFileSync(cssPath, 'utf8');

// Parse CSS variables from :root block
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootMatch) {
  console.error('Error: No :root block found in index.css');
  process.exit(1);
}

const rootContent = rootMatch[1];
const varRegex = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
const tokens = {};
let match;
while ((match = varRegex.exec(rootContent)) !== null) {
  tokens[match[1]] = match[2].trim();
}

let md = `# 🎨 RescueShip Design System (DESIGN.md)

> **Auto-Generated Design Specification**
> Single source of truth derived from \`frontend/src/index.css\`.
> Generated: ${new Date().toISOString()}

---

## 1. Aesthetic Vision & Brand Archetype
- **Theme Concept:** Developer Console / Mission Control / Telemetry Terminal
- **Mood:** Precise, high-contrast, atmospheric dark canvas with rich phosphor accents
- **Core Value Proposition:** Autonomous NDR rescue and revenue recovery for D2C brands

---

## 2. Canvas & Surface Hierarchy

| Token | Value | Purpose / Role |
| :--- | :--- | :--- |
| \`--bg-void\` | \`${tokens['--bg-void'] || '#050508'}\` | Deep space root canvas background |
| \`--bg-card\` | \`${tokens['--bg-card'] || '#0d0d12'}\` | Primary container & dashboard card background |
| \`--bg-input\` | \`${tokens['--bg-input'] || '#12121a'}\` | Form field and interactive input fill |
| \`--border-color\` | \`${tokens['--border-color'] || 'rgba(255,255,255,0.08)'}\` | Subtle structural border boundary |
| \`--border-hover\` | \`${tokens['--border-hover'] || 'rgba(255,255,255,0.18)'}\` | Active hover boundary highlight |

---

## 3. Brand & Status Palette (WCAG 2.1 AA Compliant)

| Token | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| \`--indigo\` | \`${tokens['--indigo'] || '#4f46e5'}\` | Primary brand accent & high-priority CTAs |
| \`--indigo-soft\` | \`${tokens['--indigo-soft'] || '#818cf8'}\` | Secondary interactive highlights & prefixes |
| \`--emerald\` | \`${tokens['--emerald'] || '#10b981'}\` | Successful order rescues, recovered revenue, online status |
| \`--amber\` | \`${tokens['--amber'] || '#f59e0b'}\` | Warnings, pending attempts, delayed delivery states |
| \`--rose\` | \`${tokens['--rose'] || '#f43f5e'}\` | Intercepted NDR alerts, failed delivery remarks |
| \`--danger\` | \`${tokens['--danger'] || '#ef4444'}\` | Critical errors and cancellation states |

---

## 4. Typography & Foreground Tokens

| Token | Value | Hierarchy / Contrast |
| :--- | :--- | :--- |
| \`--text-1\` | \`${tokens['--text-1'] || '#f4f4f5'}\` | Primary high-emphasis headings & titles |
| \`--text-2\` | \`${tokens['--text-2'] || '#d4d4d8'}\` | Secondary body text & telemetry feed (10:1 contrast) |
| \`--text-3\` | \`${tokens['--text-3'] || '#9ca3af'}\` | Muted captions, timestamps, subtle labels (> 6.8:1 contrast) |
| \`--font-body\` | \`${tokens['--font-body'] || 'Inter'}\` | General interface & body typography |
| \`--font-display\` | \`${tokens['--font-display'] || 'Space Grotesk'}\` | Hero headings & statement typography |
| \`--font-mono\` | \`${tokens['--font-mono'] || 'JetBrains Mono'}\` | Telemetry logs, AWBs, order IDs, currency figures |

---

## 5. Spatial System (4px Base Grid)

| Token | Pixel Equivalent | Standard Usage |
| :--- | :--- | :--- |
| \`--space-05\` | 2px | Micro padding & tight icon alignment |
| \`--space-1\` | 4px | Inline icon gaps & compact badge padding |
| \`--space-2\` | 8px | Button inline gaps, input inner spacing |
| \`--space-3\` | 12px | Card internal element separation |
| \`--space-4\` | 16px | Standard component padding & layout gutters |
| \`--space-6\` | 24px | Section gaps & card margins |
| \`--space-8\` | 32px | Sub-section vertical rhythm |
| \`--space-12\` | 48px | Page section spacing |
| \`--space-16\` | 64px | Hero container vertical breathing room |

---

## 6. Radius Scale

| Token | Value | Component Application |
| :--- | :--- | :--- |
| \`--radius-xs\` | \`${tokens['--radius-xs'] || '4px'}\` | Small badges, log pills, feed tags |
| \`--radius-sm\` | \`${tokens['--radius-sm'] || '6px'}\` | Inputs, sub-buttons, dropdown items |
| \`--radius-md\` | \`${tokens['--radius-md'] || '8px'}\` | Primary buttons, alert containers |
| \`--radius-lg\` | \`${tokens['--radius-lg'] || '12px'}\` | Dashboard cards, station panels |
| \`--radius-xl\` | \`${tokens['--radius-xl'] || '16px'}\` | Hero containers, terminal windows |
| \`--radius-2xl\` | \`${tokens['--radius-2xl'] || '24px'}\` | Outer modal shells |
| \`--radius-full\` | \`${tokens['--radius-full'] || '9999px'}\` | Pill badges, round avatar buttons |

---

## 7. Accessibility & Code Standards
1. **WCAG 2.1 AA Compliance:** All foreground text must achieve at least 4.5:1 contrast against its background.
2. **Zero Raw RGBA:** All component CSS must reference CSS variables defined in \`index.css\`.
3. **Stylelint Enforcement:** CI automatically verifies CSS token compliance via \`npm run lint:css\`.
4. **Automated E2E:** Visual regressions and Axe accessibility scans are tested via \`npm run test:e2e\`.
`;

fs.writeFileSync(outputPath, md, 'utf8');
console.log('✨ DESIGN.md successfully generated at: ' + outputPath);
