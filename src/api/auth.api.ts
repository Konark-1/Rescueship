import { Router, Request, Response } from 'express';
import { Merchant } from '../models';
import { generateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/register
 * Merchant Signup
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, platform } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Missing required fields: name, email, password' });
    return;
  }

  try {
    const existing = await Merchant.findOne({ email });
    if (existing) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const merchant = await Merchant.create({
      name,
      email,
      password,
      platform: platform || 'custom',
      settings: {
        codConversion: { enabled: false, incentiveType: 'flat', incentiveAmount: 0, minOrderValue: 0, messageLanguage: 'en' },
        ndrRescue: { enabled: false, escalationChain: [4, 12, 24], messageLanguage: 'en', fakeAttemptDetection: false },
      },
    });

    const token = generateToken(merchant._id.toString());
    logger.info('New merchant registered successfully', { merchantId: merchant._id });

    res.status(201).json({
      message: 'Registration successful',
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        platform: merchant.platform,
        onboardingStatus: merchant.onboardingStatus,
      },
    });
  } catch (err: any) {
    logger.error('Registration failed', { error: err.message });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Merchant Login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await merchant.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(merchant._id.toString());
    logger.info('Merchant logged in successfully', { merchantId: merchant._id });

    res.status(200).json({
      message: 'Login successful',
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        platform: merchant.platform,
        onboardingStatus: merchant.onboardingStatus,
      },
    });
  } catch (err: any) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

export default router;
