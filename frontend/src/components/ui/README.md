# frontend/src/components/ui/

> **Purpose**: Accessible, theme-locked primitive UI components — buttons, dialogs, badges, cards, switches, tables, and loading skeletons.

## File Catalog

| Component | Role |
| :--- | :--- |
| `badge.tsx` | Status and severity badge (`success`, `warning`, `error`, `neutral`, `purple`). |
| `button.tsx` | Primary, secondary, outline, and ghost action buttons with loading spinners. |
| `card.tsx` | Card layout primitive with header, title, description, content, and footer slots. |
| `dialog.tsx` | Accessible modal dialog with focus trap, Esc keyboard dismiss, and overlay backdrop. |
| `skeleton.tsx` | Animated loading shimmer skeleton for asynchronous states. |
| `switch.tsx` | Accessible toggle switch with ARIA `role="switch"` and keyboard navigation. |
| `table.tsx` | Composable data table primitives: Table, TableHeader, TableBody, TableRow, TableCell. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/accessibility.spec.ts` | Playwright | `PASS` ✅ | Keyboard navigation, focus traps, ARIA roles, and high-contrast compliance |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Component rendering across all routes and layout contexts |
