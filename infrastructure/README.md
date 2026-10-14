# infrastructure/

> **Purpose**: Production infrastructure declarations, automated uptime monitoring configs, and cold-start keepalive definitions.

## File Catalog

| File | Purpose |
|------|---------|
| `uptime-monitor.yaml` | Uptime monitor configuration for BetterStack / UptimeRobot / cron-job.org. Defines 3-minute and 5-minute keepalive probes to `https://rescueship.onrender.com/health` and `https://rescueship.netlify.app`. |

## Key Invariants

- Keepalive probes ping `/health` every 180–300s to eliminate Render free/starter container sleep.
- Deep health checks verify active MongoDB connections and Redis responsiveness (`{"status":"healthy","checks":{"mongodb":"ok","redis":"ok"}}`).

## 🧪 Verified Health & Status

| Target | Expected | Status | Probe Verification |
| :--- | :---: | :---: | :--- |
| `https://rescueship.onrender.com/health` | HTTP 200 | `PASS` ✅ | `{"status":"healthy","checks":{"mongodb":"ok","redis":"ok"}}` |
| `https://rescueship.netlify.app` | HTTP 200 | `PASS` ✅ | Primary global CDN deployment serving React 19 SPA |
