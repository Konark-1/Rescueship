// Unit tests exercise payment flows without a live gateway webhook. Production requires
// paymentConfig.webhookVerifiedAt (see payment-guard.paymentWebhookReady); the gate itself
// is covered in tests/refund-and-gateway.test.ts, which turns this flag back on.
process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK = process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK || 'false';
