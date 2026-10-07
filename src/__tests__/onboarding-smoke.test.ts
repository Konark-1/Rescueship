/**
 * onboarding-smoke.test.ts
 * ─────────────────────────────────────────────────────────────
 * Validates production onboarding resilience:
 * - Meta Embedded Signup gracefully degrades with 503 instead of crashing.
 * - WooCommerce OAuth state verification prevents CSRF and enforces 400 error guards.
 */

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_test_key_123456';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

import { metaEmbeddedSignupService } from '../services/meta-embedded-signup.service';
import { woocommerceService } from '../services/woocommerce-connect.service';

describe('Production Onboarding Resilience Smoke Tests (Task 4.5)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Meta Embedded Signup Service Initialization & Fallback', () => {
    it('returns initialized: false with statusCode 503 when OAuth env vars are missing', () => {
      delete process.env.META_APP_ID;
      delete process.env.META_APP_SECRET;
      delete process.env.META_REDIRECT_URI;

      const result = metaEmbeddedSignupService.initialize();
      expect(result.initialized).toBe(false);
      expect(result.statusCode).toBe(503);
      expect(result.error).toContain('Meta Embedded Signup unconfigured');
    });

    it('returns initialized: true with statusCode 200 when all OAuth env vars are set', () => {
      process.env.META_APP_ID = '1234567890';
      process.env.META_APP_SECRET = 'secret_test_meta_key';
      process.env.META_REDIRECT_URI = 'https://rescueship.onrender.com/api/connect/whatsapp/callback';

      const result = metaEmbeddedSignupService.initialize();
      expect(result.initialized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it('connect() throws graceful Error with statusCode 503 instead of unhandled crash', async () => {
      delete process.env.META_APP_ID;
      delete process.env.META_APP_SECRET;

      try {
        await metaEmbeddedSignupService.connect('merchant_test_123', 'fake_auth_code');
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.statusCode).toBe(503);
        expect(err.message).toContain('Meta Embedded Signup unconfigured');
      }
    });
  });

  describe('WooCommerce OAuth State Parameter Verification', () => {
    it('rejects missing or empty state with statusCode 400', () => {
      const res1 = woocommerceService.verifyOAuthState(undefined);
      expect(res1.valid).toBe(false);
      expect(res1.statusCode).toBe(400);

      const res2 = woocommerceService.verifyOAuthState('');
      expect(res2.valid).toBe(false);
      expect(res2.statusCode).toBe(400);
    });

    it('rejects short state tokens (< 16 chars) due to insufficient entropy', () => {
      const shortToken = 'short_abc123';
      const res = woocommerceService.verifyOAuthState(shortToken);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.error).toContain('CSRF protection');
    });

    it('rejects state token if bound merchant ID does not match expected merchant', () => {
      const stateWithWrongMerchant = 'merchant_attacker_999:abcdef1234567890xyz';
      const res = woocommerceService.verifyOAuthState(stateWithWrongMerchant, 'merchant_victim_111');
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.error).toContain('mismatch');
    });

    it('accepts valid state token with sufficient entropy and matching merchant binding', () => {
      const validBoundState = 'merchant_valid_777:random_secure_token_abcdef123456';
      const res = woocommerceService.verifyOAuthState(validBoundState, 'merchant_valid_777');
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.error).toBeUndefined();
    });

    it('accepts valid unbound state token with >= 16 random characters', () => {
      const secureRandomState = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const res = woocommerceService.verifyOAuthState(secureRandomState);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });
  });
});
