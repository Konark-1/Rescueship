import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Merchant } from '../src/models';
import { authenticateToken, authenticateSseToken, generateToken } from '../src/middleware/auth';
import { requireActiveSubscription, requireFeature } from '../src/middleware/planGating.middleware';
import liveopsRouter from '../src/api/liveops.api';

jest.mock('../src/services/liveops-watchtower.service', () => ({
  checkDeadLetterQueue: jest.fn().mockResolvedValue({ status: 'ok', deadLetterQueue: { failed: 0 }, totalFailedAcrossQueues: 0 }),
  checkWebhookFailureRate: jest.fn().mockResolvedValue({ status: 'ok', failureRatePercentage: 0, totalEvents: 0 }),
}));

describe('Auth, plan gating and ops access', () => {
  const merchantId = '507f1f77bcf86cd799439011';
  let token: string;
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
    token = generateToken(merchantId, 1);
  });
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Merchant, 'findById').mockImplementation(((id: string) => {
      const doc = { _id: id, tokenVersion: 1, billing: { plan: 'starter', status: 'cancelled' } };
      const p: any = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    }) as any);
  });

  const app = express();
  app.get('/plain', authenticateToken, (_req, res) => { res.json({ ok: true }); });
  app.get('/stream', authenticateSseToken, (_req, res) => { res.json({ ok: true }); });
  app.get('/data', authenticateToken, requireActiveSubscription, (_req, res) => { res.json({ ok: true }); });
  app.post('/data', authenticateToken, requireActiveSubscription, (_req, res) => { res.json({ ok: true }); });
  app.get('/fraud', authenticateToken, requireFeature('fraud_watchtower'), (_req, res) => { res.json({ ok: true }); });
  app.use('/liveops', liveopsRouter);

  it('accepts ?token= only on the SSE route', async () => {
    expect((await request(app).get(`/plain?token=${token}`)).status).toBe(401);
    expect((await request(app).get(`/stream?token=${token}`)).status).toBe(200);
    expect((await request(app).get('/plain').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('returns 401 (not 403) for an expired token so the app logs out', async () => {
    const expired = jwt.sign({ merchantId, tokenVersion: 1 }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await request(app).get('/plain').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('inactive subscription keeps reads open but blocks writes', async () => {
    expect((await request(app).get('/data').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).post('/data').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('ops endpoints need the ops key', async () => {
    delete process.env.OPS_API_KEY;
    expect((await request(app).post('/liveops/check-and-alert')).status).toBe(401);
    const pub = await request(app).get('/liveops/status');
    expect(pub.body.checks).toBeUndefined();
    process.env.OPS_API_KEY = '1234567890123456';
    const priv = await request(app).get('/liveops/status').set('x-ops-key', '1234567890123456');
    expect(priv.body.checks).toBeDefined();
  });
});
