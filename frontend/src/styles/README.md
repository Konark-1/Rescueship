# styles/

> **Purpose**: CSS styling system — comprehensive design tokens and component styles for the authenticated console.

## File Catalog

| File | Size | Sections |
|------|------|----------|
| `app.css` | 19,928 bytes | Page scaffolding, panel containers, stat cards, button system, forms, badges, tables, modals, toasts, code blocks, scrollbars |

## CSS Class Reference

| Category | Classes |
|----------|---------|
| Pages | `.page`, `.page-head`, `.page-head__title`, `.page-head__actions` |
| Panels | `.panel`, `.panel--accent`, `.panel__head`, `.panel__body` |
| Stats | `.stat-grid`, `.stat`, `.stat__num`, `.stat__tone` |
| Buttons | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-outline`, `.btn-danger`, `.btn-sm`, `.btn-lg` |
| Forms | `.input-group`, `.input-label`, `.input-text`, `.input-select`, `.input-toggle` |
| Badges | `.badge`, `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-danger` |
| Tables | `.table-wrap`, `.table-head`, `.table-row`, `.table-cell` |

## Key Invariants

- ALL colors MUST reference CSS variables from `../index.css` (e.g., `var(--bg-void)`, `var(--indigo)`)
- ALL spacing MUST use `--space-*` scale (4px grid)
- ZERO raw `rgba()` values or magic pixel numbers
