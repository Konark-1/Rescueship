# public/

> **Purpose**: Static demo UI — local backend dashboard and mock Shopify checkout for development testing.

## File Catalog

| File | Role |
|------|------|
| `index.html` | Backend health dashboard with E2E simulation trigger |
| `script.js` | Client JS: `checkHealth()`, `runSimulation()`, `fetchLatestData()` |
| `shopify.html` | Mock e-commerce product page with COD checkout modal |
| `shopify-script.js` | Client JS: `initMerchant()`, `placeOrder()` — submits simulated webhook |

## Key Invariants

- These are development-only pages served by Express at the backend root
- NOT part of the production frontend (which is the React app in `../../frontend/`)
- `placeOrder()` sends a simulated `orders/create` webhook to `/webhooks/shopify/order-created`
