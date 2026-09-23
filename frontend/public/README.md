# public/

> **Purpose**: Static assets and Netlify routing — SPA redirects and favicon.

## File Catalog

| File | Role |
|------|------|
| `_redirects` | Netlify config: proxies `/api/*` to `https://rescueship.onrender.com/api/:splat`, all other routes to `/index.html` |
| `favicon.svg` | Browser tab icon |
| `icons.svg` | SVG sprite sheet: `bluesky-icon`, `discord-icon`, `documentation-icon`, `github-icon`, `social-icon` |

## Key Invariants

- `_redirects` proxy rule is CRITICAL — without it, API calls from the frontend break in production
- The `200!` force flag ensures Netlify proxies (not redirects) API requests
