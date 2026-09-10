import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Merchant } from '../models/Merchant';
import { generateToken } from '../middleware/auth';
import { emailService } from '../services/email.service';
import { passwordResetLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { frontendOrigin } from '../config/env';

const router = Router();

const ONBOARDING_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

/** Accepts "https://shop.example.com/path" or "shop.example.com"; returns a bare, validated hostname or undefined. */
function normalizeStoreHost(input: unknown): string | undefined {
  if (typeof input !== 'string' || !input.trim()) return undefined;
  let host = input.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].split(':')[0];
  if (host.startsWith('www.')) host = host.slice(4);
  return HOSTNAME_RE.test(host) ? host : undefined;
}

/**
 * POST /api/plg/signup
 * Public endpoint. Creates a merchant record + emails a magic onboarding link.
 *
 * Security:
 *   - The raw token is delivered ONLY in the email to the account owner. It is
 *     stored hashed and never logged or forwarded to ops channels.
 *   - Existing accounts that have completed onboarding or hold a password never
 *     get a fresh magic link (that would be an unauthenticated account-recovery
 *     path); they are told to sign in instead. Response is uniform.
 *   - Rate limited per IP+email.
 */
router.post('/signup', passwordResetLimiter, async (req: Request, res: Response) => {
  const genericResponse = { success: true, message: 'Check your email for the onboarding link and setup call details.' };
  try {
    const { email, storeUrl } = req.body ?? {};

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const storeHost = normalizeStoreHost(storeUrl);
    if (storeUrl !== undefined && storeUrl !== '' && !storeHost) {
      return res.status(400).json({ success: false, error: 'Store URL must be a valid domain, e.g. shop.example.com' });
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ONBOARDING_TOKEN_TTL_MS);
    let merchantName = storeHost ? storeHost.split('.')[0] : cleanEmail.split('@')[0];

    const existing = await Merchant.findOne({ email: cleanEmail }).select('name password googleId onboarding onboardingStatus');
    if (existing) {
      const alreadyOnboarded = existing.onboardingStatus === 'completed' || existing.onboarding?.status === 'completed';
      const hasCredentials = !!existing.password || !!existing.googleId;
      if (alreadyOnboarded || hasCredentials) {
        // Do not mint a login-capable token for an established account. Nudge to sign in instead.
        logger.info('[PLG] Signup for existing established account — no magic link issued', { merchantId: existing._id });
        void emailService.sendEmail({
          to: cleanEmail,
          subject: 'Your RescueShip account already exists',
          text: `Hello ${existing.name},\n\nSomeone (probably you) requested onboarding for this email, but an account already exists. Sign in at ${frontendOrigin()}/login, or use "Forgot password" if you need to set one.\n\nIf this wasn't you, no action is needed.\n\n— RescueShip Team`,
        }).catch(() => {});
        return res.json(genericResponse);
      }
      await Merchant.updateOne(
        { _id: existing._id },
        { $set: { 'onboarding.status': existing.onboarding?.status || 'invited', 'onboarding.token': tokenHash, 'onboarding.tokenExpiresAt': expiresAt, 'onboarding.invitedAt': new Date() } }
      );
      merchantName = existing.name || merchantName;
    } else {
      await new Merchant({
        name: merchantName.slice(0, 120),
        email: cleanEmail,
        // No password: the merchant sets one via the authenticated change-password / reset flow.
        platform: 'custom',
        storeName: storeHost,
        onboarding: { status: 'invited', token: tokenHash, tokenExpiresAt: expiresAt, invitedAt: new Date() },
        billing: { status: 'pre_signup' },
        sandbox: { enabled: false, testRescuesSent: 0, testRescuesSucceeded: 0, graduationThreshold: 3, graduated: false },
        metrics: { ndrReceived: 0, rescuesAttempted: 0, rescuesSucceeded: 0 },
      }).save();
    }

    const onboardingUrl = `${frontendOrigin()}/onboard?token=${rawToken}`;
    logger.info('[PLG] Manifest signup: onboarding link issued', { email: cleanEmail, storeHost: storeHost || 'N/A' });

    // 1. Return immediate success response to user
    res.json(genericResponse);

    // 2. Dispatch merchant confirmation & operator alert asynchronously in background
    Promise.allSettled([
      emailService.sendManifestConfirmationEmail(cleanEmail, storeHost, onboardingUrl, merchantName),
      emailService.notifyOwner(`New Integration Request: ${cleanEmail} (${storeHost || 'Store'})`, {
        'Merchant Email': cleanEmail,
        'Store Domain': storeHost || 'Not provided',
        'Requested At': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        'Onboarding Portal Link': onboardingUrl,
        'Next Step': 'Reach out to merchant within 24-48 hours to assist with setup',
      })
    ]).then(([merchantRes, ownerRes]) => {
      logger.info('[PLG] Integration request emails dispatched', {
        merchantEmail: merchantRes.status,
        operatorAlert: ownerRes.status,
      });
    }).catch(dispatchErr => {
      logger.error('[PLG] Background email dispatch error', { error: dispatchErr.message });
    });
  } catch (err: any) {
    logger.error('[PLG] Signup failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Something went wrong. Try again.' });
  }
});

/**
 * GET /api/plg/validate-token
 */
router.get('/validate-token', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string' || token.length < 32 || token.length > 128) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const merchant = await Merchant.findOne({
      'onboarding.token': hashToken(token),
      'onboarding.tokenExpiresAt': { $gt: new Date() },
    }).select('storeName onboarding.status').lean();

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    res.json({
      success: true,
      merchant: {
        storeName: (merchant as any).storeName,
        onboardingStatus: (merchant as any).onboarding?.status,
      },
    });
  } catch (err: any) {
    logger.error('[PLG] validate-token failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Something went wrong. Try again.' });
  }
});

/**
 * POST /api/plg/activate
 * Exchanges a magic-link token for a session exactly once (the token is
 * consumed atomically in the same query that matches it).
 */
router.post('/activate', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body ?? {};
    if (!token || typeof token !== 'string' || token.length < 32 || token.length > 128) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const merchant = await Merchant.findOneAndUpdate(
      { 'onboarding.token': hashToken(token), 'onboarding.tokenExpiresAt': { $gt: new Date() } },
      {
        $set: { 'onboarding.status': 'in_progress', 'onboarding.startedAt': new Date() },
        $unset: { 'onboarding.token': 1, 'onboarding.tokenExpiresAt': 1 },
      },
      { new: true }
    ).select('_id tokenVersion');

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const sessionToken = generateToken(merchant._id.toString(), merchant.tokenVersion ?? 1);
    logger.info('[PLG] Onboarding token exchanged for session', { merchantId: merchant._id });

    res.json({ success: true, token: sessionToken, merchantId: merchant._id.toString() });
  } catch (err: any) {
    logger.error('[PLG] activate failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Something went wrong. Try again.' });
  }
});

router.get('/email-status', (_req: Request, res: Response) => {
  res.json(emailService.getStatus());
});

export default router;
