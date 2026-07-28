import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Merchant } from '../models/Merchant';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/plg/signup
 * Public endpoint. Creates a merchant record + generates a magic onboarding link.
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, storeUrl } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if already exists
    const existing = await Merchant.findOne({ ownerEmail: cleanEmail }).lean();
    if (existing) {
      return res.json({ success: true, message: 'Check your email for the onboarding link.' });
    }

    // Create merchant record
    const onboardingToken = crypto.randomBytes(32).toString('hex');

    const newMerchant = new Merchant({
      email: cleanEmail,
      ownerEmail: cleanEmail,
      password: crypto.randomBytes(16).toString('hex'), // temp random password
      storeName: storeUrl ? storeUrl.split('.')[0] : 'New Store',
      onboarding: {
        status: 'invited',
        token: onboardingToken,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedAt: new Date(),
      },
      billing: {
        status: 'pre_signup',
        plan: null,
      },
      sandbox: {
        enabled: false,
        testRescuesSent: 0,
        testRescuesSucceeded: 0,
        graduationThreshold: 3,
        graduated: false,
      },
      metrics: {
        ndrReceived: 0,
        rescuesAttempted: 0,
        rescuesSucceeded: 0,
      },
    });

    await newMerchant.save();

    const onboardingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/onboard?token=${onboardingToken}`;
    logger.info(`[PLG] New signup: ${cleanEmail} → ${newMerchant._id} | Link: ${onboardingUrl}`);

    res.json({
      success: true,
      message: 'Check your email for the onboarding link.',
    });
  } catch (err: any) {
    logger.error('[PLG] Signup failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Something went wrong. Try again.' });
  }
});

/**
 * GET /api/plg/validate-token
 */
router.get('/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const merchant = await Merchant.findOne({
      'onboarding.token': token,
      'onboarding.tokenExpiresAt': { $gt: new Date() },
    }).lean();

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    res.json({
      success: true,
      merchant: {
        merchantId: merchant._id.toString(),
        storeName: (merchant as any).storeName,
        onboardingStatus: (merchant as any).onboarding?.status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/plg/activate
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token required' });

    const merchant = await Merchant.findOne({
      'onboarding.token': token,
      'onboarding.tokenExpiresAt': { $gt: new Date() },
    });

    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    (merchant as any).onboarding = {
      ...(merchant as any).onboarding,
      status: 'in_progress',
      startedAt: new Date(),
    };
    await merchant.save();

    const jwtSecret = process.env.JWT_SECRET || 'jwt_secret_dev_key';
    const sessionToken = jwt.sign({ merchantId: merchant._id.toString(), type: 'merchant' }, jwtSecret, { expiresIn: '30d' });

    res.json({
      success: true,
      token: sessionToken,
      merchantId: merchant._id.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
