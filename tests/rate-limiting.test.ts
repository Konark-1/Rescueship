import express from 'express';
import request from 'supertest';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

describe('Rate Limiting Enforcement', () => {
  it('enforces 429 Too Many Requests when request count exceeds limit', async () => {
    const app = express();
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests from this IP. Please try again later.',
        retryAfterSeconds: 60,
      },
    });

    app.use('/test-rate-limit', testLimiter, (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/test-rate-limit');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    }

    // 6th request must be rejected with 429
    const blockedRes = await request(app).get('/test-rate-limit');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toContain('Too many requests');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  it('includes standard RFC rate limit headers on responses', async () => {
    const app = express();
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use('/test-headers', testLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get('/test-headers');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('10');
    expect(res.headers['ratelimit-remaining']).toBe('9');
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it('throttles login attempts using IP + email composite key', async () => {
    const app = express();
    app.use(express.json());

    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: any) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
        return `${ipKeyGenerator(req.ip || '')}|${email}`;
      },
      message: { error: 'Too many failed login attempts.' },
    });

    app.post('/auth/login', loginLimiter, (req, res) => {
      res.status(200).json({ message: 'Login evaluated', email: req.body.email });
    });

    const targetEmail = 'merchant@brand.com';

    // 3 attempts for merchant@brand.com
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: targetEmail, password: 'wrong' });
      expect(res.status).toBe(200);
    }

    // 4th attempt for merchant@brand.com blocked
    const blockedRes = await request(app)
      .post('/auth/login')
      .send({ email: targetEmail, password: 'wrong' });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toContain('Too many failed login attempts');

    // A different email from the same IP should still have its own quota
    const otherEmailRes = await request(app)
      .post('/auth/login')
      .send({ email: 'other@brand.com', password: 'wrong' });
    expect(otherEmailRes.status).toBe(200);
  });
});
