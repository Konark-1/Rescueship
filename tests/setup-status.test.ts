/** The operator setup report never leaks secret values and flags what is missing. */
jest.mock('../src/utils/webhook-heartbeat', () => ({
  lastWebhookSeen: jest.fn(async (src: string) => (src === 'SHOPIFY' ? new Date('2026-10-10T00:00:00Z') : null)),
  markWebhookSeen: jest.fn(),
}));
jest.mock('../src/models', () => ({ Merchant: { countDocuments: jest.fn().mockResolvedValue(3) } }));
import { getSetupStatus } from '../src/services/setup-status.service';

describe('setup status', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('reports missing keys with a fix and never returns values', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
    process.env.RAZORPAY_KEY_SECRET = 'super-secret-value';
    delete process.env.META_CONFIG_ID;
    const r = await getSetupStatus();
    const json = JSON.stringify(r);
    expect(json).not.toContain('super-secret-value');
    expect(json).not.toContain('rzp_test_abc123');
    const cfg = r.items.find((i) => i.key === 'META_CONFIG_ID')!;
    expect(cfg.state).toBe('missing');
    expect(cfg.fix).toMatch(/Embedded Signup/);
    expect(r.items.find((i) => i.key === 'RAZORPAY_MODE')!.state).toBe('waiting'); // test keys
    expect(r.items.find((i) => i.key === 'SHOPIFY_WEBHOOK')!.state).toBe('ok');
    expect(r.items.find((i) => i.key === 'WHATSAPP_WEBHOOK')!.state).toBe('waiting');
    expect(r.ready).toBe(false);
  });

  it('treats placeholder values as missing', async () => {
    process.env.OPS_API_KEY = 'your-ops-key';
    const r = await getSetupStatus();
    expect(r.items.find((i) => i.key === 'OPS_API_KEY')!.state).toBe('missing');
  });
});
