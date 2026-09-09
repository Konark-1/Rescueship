import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Merchant } from '../models';
import { generateToken, AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { loginLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import { SecurityAlertService } from '../services/security-alert.service';
import { emailService } from '../services/email.service';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const clean = email.toLowerCase().trim();
  if (!clean || clean.length > 254 || !clean.includes('@')) return null;
  return clean;
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/register
 * Merchant Signup
 *
 * SECURITY: There is intentionally NO "setupPassword" branch here. Setting a
 * password on an existing (Google-linked) account is an account-recovery
 * action and must go through the emailed reset token flow below.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, platform } = req.body ?? {};

  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }

  try {
    const existing = await Merchant.findOne({ email: cleanEmail }).select('_id googleId');
    if (existing) {
      if (existing.googleId) {
        res.status(409).json({
          error: 'An account with this email was registered using Google. Sign in with Google, or use "Forgot password" to set a password.',
          code: 'GOOGLE_ACCOUNT_EXISTS',
          hasGoogleAuth: true,
          canSetupPassword: false,
        });
        return;
      }

      res.status(400).json({
        error: 'Email already registered. Please sign in with your email and password.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
      return;
    }

    if (!name || typeof name !== 'string' || !password) {
      res.status(400).json({ error: 'Missing required fields: name, password' });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({ error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` });
      return;
    }

    const allowedPlatforms = ['shopify', 'woocommerce', 'custom'];
    if (platform !== undefined && !allowedPlatforms.includes(platform)) {
      res.status(400).json({ error: 'Invalid platform' });
      return;
    }

    const merchant = await Merchant.create({
      name: name.trim().slice(0, 120),
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
  const { email, password } = req.body ?? {};

  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const merchant = await Merchant.findOne({ email: cleanEmail });
    if (!merchant) {
      // Run a dummy compare so timing does not reveal whether the email exists.
      await Merchant.dummyCompare(password);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Google-linked account with no password yet: direct to Google or reset flow.
    // Note: we deliberately do NOT allow the caller to set a password here.
    if (merchant.googleId && !merchant.password) {
      await Merchant.dummyCompare(password);
      res.status(401).json({
        error: 'This account was registered using Google. Sign in with Google, or use "Forgot password" to set a password.',
        code: 'GOOGLE_ACCOUNT_NO_PASSWORD',
        hasGoogleAuth: true,
        canSetupPassword: false,
      });
      return;
    }

    const isMatch = await merchant.comparePassword(password);
    if (!isMatch) {
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
      // Account exists but not yet linked to Google
      if (!merchant.googleId) {
        if (password && (await merchant.comparePassword(password))) {
          // Explicit password confirmation → link (kept for backward compat)
          merchant.googleId = googleId;
          await merchant.save();
          logger.info('Google account linked via password confirmation', { merchantId: merchant._id });
        } else if (payload.email_verified === true) {
          // JIT auto-link: Google itself verified this user owns the email.
          // Equivalent to "if you own the inbox, you own the account" — the same
          // guarantee a password-reset email flow relies on.
          merchant.googleId = googleId;
          await merchant.save();
          logger.info('Google account auto-linked via verified email', { merchantId: merchant._id, email: cleanEmail });
        } else {
          logger.warn('Google OAuth login rejected: email not verified by provider', { email: cleanEmail });
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
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== 'string' || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password are required' });
    return;
  }

  if (!isValidPassword(newPassword)) {
    res.status(400).json({ error: `New password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` });
    return;
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    // Google-only accounts (no password) must use the reset-token flow to set one.
    if (!merchant.password) {
      res.status(400).json({ error: 'No password is set on this account. Use "Forgot password" to set one.', code: 'NO_PASSWORD_SET' });
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
    // Invalidate any outstanding reset token once the password has been changed.
    await Merchant.updateOne({ _id: merchant._id }, { $unset: { passwordReset: 1 } });

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

/**
 * POST /api/auth/forgot-password
 * Issues a single-use, short-lived reset token delivered to the account email.
 * Always responds 200 to avoid account enumeration. This is the ONLY way to
 * set a password on an account that does not have one (e.g. Google signups).
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  const cleanEmail = normalizeEmail(req.body?.email);
  const genericResponse = { message: 'If an account exists for that email, a password reset link has been sent.' };

  if (!cleanEmail) {
    res.status(200).json(genericResponse);
    return;
  }

  try {
    const merchant = await Merchant.findOne({ email: cleanEmail }).select('_id name email');
    if (merchant) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await Merchant.updateOne(
        { _id: merchant._id },
        { $set: { 'passwordReset.tokenHash': hashResetToken(rawToken), 'passwordReset.expiresAt': expiresAt } }
      );

      // Never log the raw token; the email is the only channel that receives it.
      void emailService.sendPasswordResetEmail(merchant.email, rawToken, merchant.name).catch((err: any) => {
        logger.error('Failed to dispatch password reset email', { merchantId: merchant._id, error: err.message });
      });
      logger.info('Password reset token issued', { merchantId: merchant._id });
    }

    res.status(200).json(genericResponse);
  } catch (err: any) {
    logger.error('Forgot password failed', { error: err.message });
    res.status(200).json(genericResponse);
  }
});

/**
 * POST /api/auth/reset-password
 * Consumes a reset token atomically (single use), sets the password and
 * revokes every existing session via tokenVersion.
 */
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token, email, newPassword } = req.body ?? {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || typeof token !== 'string' || token.length < 32 || token.length > 128) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }
  if (!isValidPassword(newPassword)) {
    res.status(400).json({ error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` });
    return;
  }

  try {
    const tokenHash = hashResetToken(token);
    // Atomic claim: the token is cleared in the same operation that matches it,
    // so two concurrent requests cannot both succeed.
    const merchant = await Merchant.findOneAndUpdate(
      {
        email: cleanEmail,
        'passwordReset.tokenHash': tokenHash,
        'passwordReset.expiresAt': { $gt: new Date() },
      },
      { $unset: { passwordReset: 1 } },
      { new: true }
    );

    if (!merchant) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    merchant.password = newPassword;
    merchant.tokenVersion = (merchant.tokenVersion ?? 1) + 1;
    await merchant.save();

    logger.info('Password reset completed; all prior sessions revoked', { merchantId: merchant._id });

    const newToken = generateToken(merchant._id.toString(), merchant.tokenVersion);
    res.status(200).json({
      message: 'Password reset successfully. All previous sessions have been invalidated.',
      token: newToken,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        platform: merchant.platform,
        onboardingStatus: merchant.onboardingStatus,
      },
    });
  } catch (err: any) {
    logger.error('Reset password failed', { error: err.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
