# lib/

> **Purpose**: Utility libraries — billing API, onboarding API, and Framer Motion presets.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `billing.ts` | Billing API + calculations | Types: `Tier`, `Cycle`. Constants: `TIERS`, `CYCLES`. Functions: `inr()`, `priceFor()`, `lossFor()`, `recommendedTier()`. API: `billingApi`. Helper: `loadRazorpay()` |
| `connect.ts` | Onboarding API | `connectApi` with 17 endpoints (state, shopifyUrl, carrier, payment, whatsapp, testPulse, finalize, skip). Auto 401 session eviction |
| `motion.ts` | Animation presets | Springs: `springDefault`, `springSnappy`, `springBouncy`. Easings: `easeSmoothOut`. Variants: `fadeUp`, `fadeIn`, `scaleUp`, `staggerContainer`, `hoverLift` |

## Key Invariants

- `connect.ts` and `billing.ts` auto-evict invalid sessions on 401 and redirect to `/login`
- `TIERS` order limits: Starter (1,000), Growth (5,000), Scale (12,000), Fleet (25,000)
- `loadRazorpay()` dynamically injects `checkout.razorpay.com/v1/checkout.js`
