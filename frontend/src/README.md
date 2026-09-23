# frontend/src/

> **Purpose**: Frontend source root — React 19 + Vite 8 + TypeScript SPA for the RescueShip merchant console.

## File Catalog

| File | Role |
|------|------|
| `main.tsx` | App entrypoint — mounts `<App/>` in `<StrictMode>` + `<GoogleOAuthProvider>` |
| `App.tsx` | Router — lazy-loaded routes, `ProtectedRoute` guard, `DashboardLayoutWrapper` |
| `index.css` | Design tokens — `:root` CSS variables for colors, spacing, typography |
| `App.css` | Base utility styles |

## Subdirectories

| Directory | Role |
|-----------|------|
| `components/` | 12 reusable UI components + icons/, motion/, story/ subdirs |
| `context/` | AuthContext provider (user, token, login/logout) |
| `hooks/` | 4 custom hooks (Lenis, magnetic, SSE realtime, scroll) |
| `lib/` | 3 utility modules (billing API, connect API, motion presets) |
| `pages/` | 14 lazy-loaded page components |
| `services/` | Axios API client with auth interceptors |
| `styles/` | `app.css` comprehensive styling system |
| `assets/` | Legacy Vite scaffold SVGs |

## Key Invariants

- ALL colors MUST use CSS variables from `index.css` — zero hardcoded colors
- ALL spacing MUST use `--space-*` scale (4px grid)
- Routes are lazy-loaded via `React.lazy()` for code splitting
- `ProtectedRoute` checks `useAuth().isAuthenticated` — redirects to `/login` if false
- API calls go through `services/api.ts` which auto-injects Bearer token and handles 401 logout
