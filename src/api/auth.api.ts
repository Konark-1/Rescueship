import { Router, Request, Response } from 'express';
import { Merchant } from '../models';
import { generateToken, AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import { SecurityAlertService } from '../services/security-alert.service';
import { emailService } from '../services/email.service';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/register
 * Merchant Signup
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, platform, setupPassword } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const existing = await Merchant.findOne({ email: cleanEmail });
    if (existing) {
      // If account is linked with Google:
      if (existing.googleId) {
        if (setupPassword) {
          if (!password || password.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters long' });
            return;
          }
          existing.password = password;
          if (name && (!existing.name || existing.name === 'Google User')) {
            existing.name = name;
          }
          await existing.save();

          const token = generateToken(existing._id.toString(), existing.tokenVersion ?? 1);
          logger.info('Password set/updated for Google account via register', { merchantId: existing._id });

          res.status(200).json({
            message: 'Password set successfully! Logged in.',
            token,
            merchant: {
              id: existing._id,
              name: existing.name,
              email: existing.email,
              platform: existing.platform,
              onboardingStatus: existing.onboardingStatus,
            },
          });
          return;
        }

        res.status(409).json({
          error: 'An account with this email was registered using Google. Try logging in with Google, or set up a password.',
          code: 'GOOGLE_ACCOUNT_EXISTS',
          hasGoogleAuth: true,
          canSetupPassword: true,
        });
        return;
      }

      res.status(400).json({
        error: 'Email already registered. Please sign in with your email and password.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
      return;
    }

    if (!name || !password) {
      res.status(400).json({ error: 'Missing required fields: name, password' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    const merchant = await Merchant.create({
      name,
      email: cleanEmail,
      password,
      platform: platform || 'custom',
      settings: {
        codConversion: { enabled: false, incentiveType: 'flat', incentiveAmount: 0, minOrderValue: 0, messageLanguage: 'en' },
        ndrRescue: { enabled: false, escalationChain: [4, 12, 24], messageLanguage: 'en', fakeAttemptDetection: false },
      },
    });

    const token = generateToken(merchant._id.toString(), merchant.tokenVersion ?? 1);
    logger.info('New merchant registered successfully', { merchantId: merchant._id });

    // Fire-and-forget: never block or fail registration on notifications
    void emailService.sendMerchantWelcome(merchant.email, merchant.name).catch(() => {});
    void emailService.notifyOwner('New merchant signup', {
      merchant: merchant.name,
      email: merchant.email,
      merchantId: merchant._id.toString(),
      platform: merchant.platform,
    });

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
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, setupPassword } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const merchant = await Merchant.findOne({ email: cleanEmail });
    if (!merchant) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check if account is linked to Google
    if (merchant.googleId) {
      if (setupPassword) {
        if (!password || password.length < 8) {
          res.status(400).json({ error: 'Password must be at least 8 characters long' });
          return;
        }
        merchant.password = password;
        await merchant.save();

        const token = generateToken(merchant._id.toString(), merchant.tokenVersion ?? 1);
        logger.info('Password set/updated for Google user on login', { merchantId: merchant._id });

        res.status(200).json({
          message: 'Password set successfully! Logged in.',
          token,
          merchant: {
            id: merchant._id,
            name: merchant.name,
            email: merchant.email,
            platform: merchant.platform,
            onboardingStatus: merchant.onboardingStatus,
          },
        });
        return;
      }

      if (!merchant.password) {
        res.status(401).json({
          error: 'This account was registered using Google. Try logging in with Google, or set up a password.',
          code: 'GOOGLE_ACCOUNT_NO_PASSWORD',
          hasGoogleAuth: true,
          canSetupPassword: true,
        });
        return;
      }
    }

    const isMatch = await merchant.comparePassword(password);
    if (!isMatch) {
      if (merchant.googleId) {
        res.status(401).json({
          error: 'Incorrect password. This account is linked to Google — you can sign in with Google or set this password below.',
          code: 'GOOGLE_ACCOUNT_PASSWORD_MISMATCH',
          hasGoogleAuth: true,
          canSetupPassword: true,
        });
        return;
      }
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(merchant._id.toString(), merchant.tokenVersion ?? 1);
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

/**
 * POST /api/auth/google
 * Google Login / Signup
 */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { credential, password } = req.body;

  if (!credential) {
    res.status(400).json({ error: 'Missing Google credential' });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Invalid Google credential payload' });
      return;
    }

    const { email, name, sub: googleId } = payload;
    const cleanEmail = email.toLowerCase().trim();

    // Check if user exists by email or googleId
    let merchant = await Merchant.findOne({ $or: [{ email: cleanEmail }, { googleId }] });

    if (!merchant) {
      // Create new merchant without password
      merchant = await Merchant.create({
        name: name || 'Google User',
        email: cleanEmail,
        googleId,
        platform: 'shopify', // Default, they will configure in onboarding
        onboardingStatus: 'pending'
      });
      logger.info('New merchant registered via Google', { merchantId: merchant._id });
    } else {
      // Account Takeover Prevention: Check if account exists with password
      if (!merchant.googleId) {
        // If password is provided in body, verify and link
        if (password && (await merchant.comparePassword(password))) {
          merchant.googleId = googleId;
          await merchant.save();
          logger.info('Google account linked via password confirmation', { merchantId: merchant._id });
        } else {
          logger.warn('Google OAuth login rejected: Account exists with password, not linked to Google', { email: cleanEmail });
          await SecurityAlertService.sendCriticalAlert('OAUTH_ACCOUNT_TAKEOVER_PROBE_BLOCKED', {
            email: cleanEmail,
            attemptedGoogleId: googleId,
            merchantId: merchant._id.toString(),
          }).catch(() => {});

          res.status(409).json({
            error: 'An account with this email already exists. Please log in with your password to link your Google account.',
            code: 'ACCOUNT_EXISTS_WITH_PASSWORD'
          });
          return;
        }
      } else if (merchant.googleId !== googleId) {
        logger.warn('Google OAuth login rejected: Google ID mismatch', { email: cleanEmail, existingGoogleId: merchant.googleId, incomingGoogleId: googleId });
        await SecurityAlertService.sendCriticalAlert('OAUTH_GOOGLE_ID_MISMATCH_BLOCKED', {
          email: cleanEmail,
          existingGoogleId: merchant.googleId,
          incomingGoogleId: googleId,
          merchantId: merchant._id.toString(),
        }).catch(() => {});

        res.status(401).json({ error: 'Google account mismatch.' });
        return;
      }
      logger.info('Merchant logged in via Google', { merchantId: merchant._id });
    }

    const token = generateToken(merchant._id.toString(), merchant.tokenVersion ?? 1);

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
    logger.error('Google Auth failed', { error: err.message });
    res.status(500).json({ error: 'Google Authentication failed. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 * Instantly revokes all active JWT tokens for the merchant by incrementing tokenVersion
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  try {
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    logger.info('Merchant logged out - all active JWTs invalidated', { merchantId, newTokenVersion: merchant.tokenVersion });
    res.status(200).json({ message: 'Logged out successfully. All active sessions have been invalidated.' });
  } catch (err: any) {
    logger.error('Logout failed', { merchantId, error: err.message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password and revoke previous JWT sessions
 */
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password are required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long' });
    return;
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const isMatch = await merchant.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    merchant.password = newPassword;
    merchant.tokenVersion = (merchant.tokenVersion ?? 1) + 1;
    await merchant.save();

    const newToken = generateToken(merchant._id.toString(), merchant.tokenVersion);
    logger.info('Password changed successfully and older sessions revoked', { merchantId });

    res.status(200).json({
      message: 'Password changed successfully. All previous sessions have been invalidated.',
      token: newToken,
    });
  } catch (err: any) {
    logger.error('Change password failed', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
