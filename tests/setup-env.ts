// Test environment: never load the real .env (live MongoDB, Redis, SMTP, gateway keys).
// Everything a test needs is set here; services that must not be called are mocked per test.
process.env.SKIP_DOTENV = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/rescueship_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6399';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345_long_enough';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'https://api.rescueship.test';
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'SECURITY_ALERT_WEBHOOK', 'OPS_ALERT_EMAIL']) {
  delete process.env[k];
}

// Unit tests exercise payment flows without a live gateway webhook. Production requires
// paymentConfig.webhookVerifiedAt (see payment-guard.paymentWebhookReady); the gate itself
// is covered in tests/refund-and-gateway.test.ts, which turns this flag back on.
process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK = process.env.PAYMENT_REQUIRE_VERIFIED_WEBHOOK || 'false';
