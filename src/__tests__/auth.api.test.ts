/**
 * Security regression tests for the auth surface.
 *
 * Attack that must stay dead: POST /register or /login with
 *   { email: <victim>, password: <attacker>, setupPassword: true }
 * previously set the password on a Google-linked account and returned a JWT.
 */
import express from 'express';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const state: { merchant: any } = { merchant: null };

jest.mock('../models', () => {
  const chain = (v: any) => ({ select: () => Promise.resolve(v), then: (r: any, j: any) => Promise.resolve(v).then(r, j) });
  return {
    Merchant: {
      findOne: jest.fn((q: any) => {
        const m = state.merchant;
        if (!m) return chain(null);
        if (q.email && q.email !== m.email) return chain(null);
        return chain(m);
      }),
      findById: jest.fn(() => Promise.resolve(state.merchant)),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(() => Promise.resolve({ modifiedCount: 1 })),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
      dummyCompare: jest.fn(() => Promise.resolve()),
    },
  };
});
jest.mock('../services/email.service', () => ({
  emailService: { sendPasswordResetEmail: jest.fn(() => Promise.resolve(true)), sendMerchantWelcome: jest.fn(() => Promise.resolve(true)), notifyOwner: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../services/security-alert.service', () => ({ SecurityAlertService: { sendCriticalAlert: jest.fn(() => Promise.resolve()) } }));
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn(() => ({ verifyIdToken: jest.fn() })) }));

import authRouter from '../api/auth.api';
import { Merchant } from '../models';
import { emailService } from '../services/email.service';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

function googleMerchant() {
  return {
    _id: '507f1f77bcf86cd799439011',
    email: 'victim@example.com',
    name: 'Victim',
    googleId: 'g-123',
    password: undefined as string | undefined,
    tokenVersion: 1,
    platform: 'shopify',
    onboardingStatus: 'completed',
    save: jest.fn(async function (this: any) { return this; }),
    comparePassword: jest.fn(async () => false),
  };
}

describe('Auth — account takeover regression', () => {
  beforeEach(() => { state.merchant = googleMerchant(); jest.clearAllMocks(); });

  it('POST /register with setupPassword:true on a Google account does NOT set a password or issue a token', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker-pass-123', name: 'x', setupPassword: true });

    expect(res.status).toBe(409);
    expect(res.body.token).toBeUndefined();
    expect(res.body.canSetupPassword).toBe(false);
    expect(state.merchant.save).not.toHaveBeenCalled();
    expect(state.merchant.password).toBeUndefined();
  });

  it('POST /login with setupPassword:true on a Google account does NOT set a password or issue a token', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker-pass-123', setupPassword: true });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(state.merchant.save).not.toHaveBeenCalled();
    expect(state.merchant.password).toBeUndefined();
  });

  it('POST /login returns a uniform 401 for unknown email and wrong password', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever-123' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe('Invalid email or password');
    expect((Merchant as any).dummyCompare).toHaveBeenCalled();
  });
});

describe('Auth — password reset flow', () => {
  beforeEach(() => { state.merchant = googleMerchant(); jest.clearAllMocks(); });

  it('POST /forgot-password stores only a hash, emails the raw token, and never reveals whether the email exists', async () => {
    const ok = await request(app).post('/api/auth/forgot-password').send({ email: 'victim@example.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

    expect(ok.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(ok.body).toEqual(unknown.body);

    const update = (Merchant.updateOne as jest.Mock).mock.calls[0][1].$set;
    const emailedToken = (emailService.sendPasswordResetEmail as jest.Mock).mock.calls[0][1];
    expect(emailedToken).toHaveLength(43); // 32 random bytes, base64url
    expect(update['passwordReset.tokenHash']).toMatch(/^[a-f0-9]{64}$/);
    expect(update['passwordReset.tokenHash']).not.toBe(emailedToken);
    expect(update['passwordReset.expiresAt'].getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it('POST /reset-password consumes the token atomically, sets the password, and bumps tokenVersion', async () => {
    const m = state.merchant;
    (Merchant.findOneAndUpdate as jest.Mock).mockImplementation((q: any, u: any) => {
      expect(q['passwordReset.tokenHash']).toMatch(/^[a-f0-9]{64}$/);
      expect(q['passwordReset.expiresAt'].$gt).toBeInstanceOf(Date);
      expect(u.$unset.passwordReset).toBe(1); // claimed + cleared in one op
      return Promise.resolve(m);
    });

    const token = 'a'.repeat(43);
    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: 'victim@example.com', token, newPassword: 'brand-new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(m.password).toBe('brand-new-password-1');
    expect(m.tokenVersion).toBe(2); // all prior JWTs invalidated
    expect(m.save).toHaveBeenCalled();
  });

  it('POST /reset-password rejects an invalid/consumed token', async () => {
    (Merchant.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: 'victim@example.com', token: 'b'.repeat(43), newPassword: 'brand-new-password-1' });
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });
});
