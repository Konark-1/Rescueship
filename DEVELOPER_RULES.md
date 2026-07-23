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

## 🧪 5. Verification Requirements Before Check-in
1. **Run TypeScript Check**: Execute `npx tsc --noEmit` in root. Zero errors allowed.
2. **Run Frontend Build**: Execute `npm run build` in `frontend/`. Zero errors allowed.
