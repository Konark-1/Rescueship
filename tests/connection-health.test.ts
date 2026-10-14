process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
process.env.API_PUBLIC_URL = 'https://api.example.test';

import axios from 'axios';
import { encryptionService as E } from '../src/services/encryption.service';
import { checkWhatsApp, checkPayment, checkCarrier, checkShopify } from '../src/services/connection-health.service';

jest.mock('axios');
const ax = axios as jest.Mocked<typeof axios>;

describe('Connection health checks (read-only probes)', () => {
  beforeEach(() => jest.resetAllMocks());

  it('flags an expired WhatsApp token (Meta code 190)', async () => {
    ax.get.mockRejectedValueOnce({ response: { data: { error: { code: 190, message: 'Session has expired' } } } });
    const r = await checkWhatsApp({ whatsappConfig: { phoneNumberId: '123', accessToken: E.encrypt('tok') } });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/expired/);
  });

  it('flags a Razorpay account with valid keys but no webhook pointing at us', async () => {
    ax.get
      .mockResolvedValueOnce({ data: { payment_links: [] } })
      .mockResolvedValueOnce({ data: { items: [] } });
    const r = await checkPayment({ paymentConfig: { provider: 'razorpay', keyId: E.encrypt('rzp_test_x'), keySecret: E.encrypt('s') } });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/No Razorpay webhook for https:\/\/api\.example\.test\/webhooks\/payment/);
  });

  it('passes Razorpay when the webhook exists and a signed event was seen', async () => {
    ax.get
      .mockResolvedValueOnce({ data: { payment_links: [] } })
      .mockResolvedValueOnce({ data: { items: [{ url: 'https://api.example.test/webhooks/payment', active: true, events: { 'payment_link.paid': true } }] } });
    const r = await checkPayment({ paymentConfig: { provider: 'razorpay', keyId: E.encrypt('rzp_test_x'), keySecret: E.encrypt('s'), webhookVerifiedAt: new Date() } });
    expect(r.ok).toBe(true);
  });

  it('checks Shiprocket by logging in; webhook-only couriers are not failures', async () => {
    ax.post.mockResolvedValueOnce({ data: { token: 't' } });
    expect((await checkCarrier({ carrierConfig: { provider: 'shiprocket', email: E.encrypt('a@b.c'), password: E.encrypt('p') } })).ok).toBe(true);
    expect((await checkCarrier({ carrierConfig: { provider: 'delhivery', mode: 'webhook_only' } })).ok).toBeNull();
  });

  it('flags a revoked Shopify token', async () => {
    ax.post.mockRejectedValueOnce({ response: { status: 401, data: { errors: 'Invalid API key or access token' } } });
    const r = await checkShopify({ shopify: { shopDomain: 'brand.myshopify.com', accessToken: E.encrypt('shpat_x') } });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/Reconnect the store/);
  });
});
