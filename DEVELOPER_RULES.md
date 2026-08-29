# RescueShip Project Developer Rules & Guidelines

All developers, contributors, and AI assistants modifying the RescueShip codebase MUST adhere to these mandatory engineering rules and safety guidelines:

---

## 🔒 1. Security & Authentication Rules
1. **Never Bypass Tenant Scoping**: EVERY database query on merchant resources MUST filter by `merchantId: req.merchant.merchantId` (or the validated merchant context). IDOR vulnerabilities are strictly prohibited.
2. **Never Store Unmasked API Secrets**: Platform tokens, carrier credentials, and payment gateway secrets MUST be encrypted using `encryption.service.ts` (AES-256-GCM) before saving to MongoDB.
3. **Always Verify Webhook HMAC Signatures**: All incoming webhook endpoints (Shopify, Meta, Razorpay, Cashfree) MUST enforce signature verification middleware. Unsigned webhooks must be rejected with `401`.
4. **Never Log Sensitive PII or Credentials**: Authorization headers, passwords, credit card data, and full phone numbers must be sanitized before passing to Winston logger calls.
5. **Token Invalidation on Password Reset**: When a merchant updates credentials, increment `merchant.tokenVersion` to invalidate stale active JWT sessions.

---

## ⚡ 2. Performance & Database Safety
1. **Atomic Database Operations**: Use Mongoose `$inc` (e.g. `currentMonthOrders`), `$set`, or `findOneAndUpdate` with state preconditions instead of un-guarded read-modify-write `save()` calls.
2. **Always Escape Regex Search Queries**: Any user-supplied search string passed to Mongoose `$regex` MUST be sanitized using the regex escaping helper to prevent ReDoS attacks.
3. **Enforce Compound Indexes**: Ensure `{ merchantId: 1, externalOrderId: 1 }` index is maintained to prevent duplicate order ingestion.
4. **Never Exceed Express Body Caps**: Restrict `express.json({ limit: '1mb' })` to prevent memory exhaustion from oversized payloads.

---

## 🛟 3. NDR & Logistics Automation Controls
1. **Always Check Global Pause**: Background workers (`codConversion`, `ndr`) MUST verify `merchant.settings.globalPause === false` before dispatching WhatsApp messages or carrier updates.
2. **Circuit Breakers for 401 Auth Failures**: Halt BullMQ job retries immediately if a third-party carrier or payment gateway returns `401 Unauthorized`. Do not flood retries.
3. **Sanitize Address Data**: Sanitize address inputs to alphanumeric characters + basic punctuation before passing to carrier APIs.
4. **Cap Payment Expiry & Minimum Floor**: Payment links MUST enforce a ₹1 minimum floor (`Math.max(1, amount)`) and a 7-day (10,080 mins) maximum expiration ceiling.

---

## 📈 4. SaaS Billing & Plan Gating
1. **Enforce Monthly Order Limits**: Verify `currentMonthOrders < planOrderLimit` before processing new orders.
2. **Plan Gating Middleware**: Protect premium features (CSV exports, custom carrier APIs, detailed analytics) using `requireFeature()`.
3. **Monthly Reset Cron Worker**: Maintain `monthlyReset.job.ts` to reset `currentMonthOrders` on the 1st of every month.

---

## 🎨 5. UI/UX & Accessibility Standards
1. **Zero Hardcoded Colors or Magic Pixels**: All page and component stylesheets MUST consume semantic CSS variables from `index.css` (e.g. `var(--bg-void)`, `var(--indigo)`, `var(--indigo-15)`, `var(--space-4)`, `var(--radius-md)`). Never write raw `rgba()` color strings or arbitrary pixel values in component CSS.
2. **Enforce 4px Spatial Grid**: Spacing, padding, and margins MUST adhere to the `--space-*` scale (`--space-1` = 4px, `--space-2` = 8px, `--space-4` = 16px, `--space-6` = 24px, `--space-8` = 32px, etc.).
3. **Semantic HTML & Navigation Landmarks**:
   - Layout navigation bars MUST use `<nav aria-label="...">` landmark elements.
   - Active navigation items MUST declare `aria-current="page"`.
   - Modals and drawers MUST declare `role="dialog"` or `role="navigation"`, manage focus, and contain `aria-expanded` and `aria-controls` on toggles.
4. **Zero Inline Styles in Core Layout Components**: Component layouts MUST be defined in dedicated CSS modules or stylesheets (e.g. `AppLayout.css`). Do not use inline `style={{}}` anti-patterns that prevent pseudo-class states or media query overrides.
5. **Modular Icon Architecture**: Do not bloat JSX pages with raw inline `<svg>` blocks. Extract SVGs into standalone components in `src/components/icons/` with default `size`, `className`, and `aria-hidden="true"` support.
6. **Form Accessibility & Quality**: All form inputs MUST include explicit `<label>` or `aria-label`, correct `autoComplete` attributes, `spellCheck={false}` on identifiers/emails, and inline error announcements (`aria-live="polite"`).

---

## 🧪 6. Verification Requirements Before Check-in
1. **Run TypeScript Check**: Execute `npx tsc --noEmit` in root. Zero errors allowed.
2. **Run Frontend Build**: Execute `npm run build` in `frontend/`. Zero errors allowed.
3. **Run Playwright E2E Tests**: Execute `npm run test:e2e` in `frontend/`. All test suites must pass.

