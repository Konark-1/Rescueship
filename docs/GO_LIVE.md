# Go live in 7 steps

Everything RescueShip needs from you, in order. Each step is a copy-paste; nothing here needs code.

| # | Where | What to do | ~Time |
|---|---|---|---|
| 0 | This folder | `npm run setup` — creates `.env.render.local` and `.env.netlify.local` (git-ignored) with every value pre-filled | 1 min |
| 1 | Render → rescueship → Environment | **Add from .env** → paste `.env.render.local` → Save. Add `META_APP_SECRET` yourself (Meta → App settings → Basic). | 3 min |
| 2 | Netlify → Site configuration → Environment variables | **Import from .env** → paste `.env.netlify.local` → redeploy | 2 min |
| 3 | Meta → WhatsApp → Configuration | Webhook: Callback `https://rescueship.onrender.com/webhooks/whatsapp`, Verify token = `WHATSAPP_VERIFY_TOKEN` → Verify and save → subscribe **messages** | 2 min |
| 4 | Meta → Facebook Login for Business → Configurations | Create → **WhatsApp Embedded Signup** → copy the id into `META_CONFIG_ID` in both files → `npm run setup` → paste again | 5 min |
| 5 | Razorpay → Account & Settings → Webhooks | Add: URL `https://rescueship.onrender.com/webhooks/razorpay/payment`, Secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `subscription.*` | 3 min |
| 6 | This folder | `npx @shopify/cli@latest app deploy` (log in with the Shopify Partner account) | 3 min |
| 7 | This folder | `npm run setup -- --check` — ✅ / ❌ for every setting and webhook, with the fix next to each ❌ | 1 min |

**Waiting on approvals (no action until they arrive):** Meta business verification → Tech Provider → App Review → app Live; Razorpay KYC → swap in live keys (step 1 again).

**Merchants** set up their own Shiprocket webhook from the onboarding Courier step: it shows the URL, the token and the three clicks.
