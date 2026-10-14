# frontend/src/components/landing/

> **Purpose**: Public marketing and PLG (Product-Led Growth) landing page components — pricing calculators, interactive scenes, feature grids, and trust badges.

## File Catalog

| Component | Role |
| :--- | :--- |
| `RoiCalculator.tsx` | Interactive ROI calculator allowing merchants to input monthly order volume and see projected RTO savings. |
| `PricingSection.tsx` | Pricing table displaying Rescue, Convert, and Prevent plans with quarterly/semi/annual cycle discounts. |
| `PlanPicker.tsx` | Interactive plan selector component with order band toggles. |
| `FeaturesGrid.tsx` | 3-column feature cards detailing 90-second rescue, fake attempt detection, and instant UPI conversion. |
| `IntelligenceCard.tsx` | Card displaying AI address parsing and colloquially phrased landmark extraction. |
| `FaqSection.tsx` | Accordion answering common merchant questions on Meta WhatsApp charges, carrier support, and onboarding. |
| `AccountabilityScene.tsx` | Scroll-driven scene comparing manual calling delays with autonomous WhatsApp workflows. |
| `StickyNav.tsx` | Responsive sticky navigation bar with quick links to demo, pricing, and login. |
| `TrustStrip.tsx` | Trust indicators showcasing Meta Tech Partner status, SOC-2 readiness, and DPDP compliance. |

## 🧪 Verified Tests & Status

| Test Suite | Framework | Status | Scope |
| :--- | :--- | :---: | :--- |
| `frontend/tests/landing-plg.spec.ts` | Playwright | `PASS` ✅ | Landing PLG visual regression, email capture, hero CTA, interactive ROI calculator |
| `frontend/tests/landing-v2.spec.ts` | Playwright | `PASS` ✅ | Responsive grids, plan toggles, FAQ accordion, order board geometry |
| `frontend/tests/all-pages.spec.ts` | Playwright | `PASS` ✅ | Full route smoke and accessibility verification |
