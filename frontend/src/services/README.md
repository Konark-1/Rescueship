# services/

> **Purpose**: Frontend HTTP API client — preconfigured Axios instance with authentication interceptors.

## File Catalog

| File | Key Exports |
|------|-------------|
| `api.ts` | `export default api` (Axios instance) |

## Configuration

- **Base URL**: Auto-resolves from `VITE_API_URL`, falls back to `https://rescueship.onrender.com` in production
- **Request interceptor**: Injects `Bearer ${token}` from localStorage
- **Response interceptor**: On 401, purges localStorage and redirects to `/login`

## Key Invariants

- ALL frontend API calls MUST go through this `api` instance (not raw `axios` or `fetch`)
- 401 responses trigger automatic session cleanup and redirect
- Base URL handles dev (localhost) and prod (Render) automatically
