/**
 * connect.api.ts — the self-serve integration surface.
 * Everything a merchant needs to wire themselves, with live state.
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { metaEmbeddedSignupService } from '../services/meta-embedded-signup.service';
import { metaTemplateService } from '../services/meta-template.service';
import { shopifyOAuthService } from '../services/shopify-oauth.service';
import { carrierConnectService } from '../services/carrier-connect.service';
import { paymentConnectService } from '../services/payment-connect.service';
import { whatsAppService } from '../services/whatsapp.service';
import { sandboxService } from '../services/sandbox.service';
import { emailService } from '../services/email.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';
import { standardMerchantLimiter } from '../middleware/merchant-rate-limiter';

const router = Router();

// The spine state the wizard renders.
router.get('/state', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const m = await Merchant.findById(req.merchant!.merchantId).lean();
    const c = (m as any).connections || {};
    const allGreen = ['shopify', 'whatsapp', 'carrier', 'payment'].every((k) => c[k]?.status === 'connected');
    res.json({
      storeName: (m as any).storeName || (m as any).shopify?.shopDomain || null,
      ownerPhone: (m as any).ownerPhone || null,
      connections: {
        shopify: c.shopify || { status: 'disconnected' },
        whatsapp: c.whatsapp || { status: 'disconnected' },
        carrier: c.carrier || { status: 'disconnected' },
        payment: c.payment || { status: 'disconnected' },
      },
      templates: (m as any).whatsappConfig?.templates || [],
      onboarding: (m as any).onboarding || { completedAt: null },
      ready: allGreen,
      paid: !!(m as any).billing?.plan && (m as any).billing.plan !== 'free_trial' && ((m as any).billing.status === 'active' || !!(m as any).billing.activatedAt),
      onboardingStatus: (m as any).onboardingStatus,
      setupCallUrl: process.env.SETUP_CALL_URL || null,
    });
  } catch (e: any) {
    logger.error('connect route error', { error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// ── Shopify ──
router.get('/shopify/url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { shop } = req.query;
  if (typeof shop !== 'string') return res.status(400).json({ error: 'shop required' });
  // No Partner app keys in dev → offer the simulated store path instead of a dead Shopify error page
  if (shopifyOAuthService.isDemoAvailable()) {
    return res.json({ demo: true });
  }
  try { res.json({ url: shopifyOAuthService.authorizeUrl(req.merchant!.merchantId, shop) }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Dev-sandbox connect: marks the store connection without any real Shopify app.
// Only enabled when NODE_ENV !== 'production' AND SHOPIFY_API_KEY is unset.
router.post('/shopify/demo-connect', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { shop } = req.body;
  if (typeof shop !== 'string') return res.status(400).json({ error: 'shop required' });
  try { res.json(await shopifyOAuthService.demoConnect(req.merchant!.merchantId, shop)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});
// Hit by Shopify (no JWT) — verifies hmac+state, then bounces the browser to the wizard.
router.get('/shopify/callback', async (req: Request, res: Response) => {
  try {
    await shopifyOAuthService.handleCallback(req.query as Record<string, string>);
    res.redirect(`${process.env.FRONTEND_URL}/onboarding?connected=shopify`);
  } catch (e: any) {
    logger.error('Shopify callback failed', { error: e.message });
    res.redirect(`${process.env.FRONTEND_URL}/onboarding?error=shopify`);
  }
});

// ── WhatsApp (Embedded Signup) ──
router.post('/whatsapp/signup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { code, businessId } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  // Fail with an actionable message instead of Meta's opaque OAuth failure.
  const metaReady = process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_CONFIG_ID;
  if (!metaReady) {
    return res.status(400).json({
      error: 'WhatsApp one-click connect is not configured on this RescueShip deployment yet (META_APP_ID / META_APP_SECRET / META_CONFIG_ID). Contact support or use "Set it up for me" — we will connect your number with you on a call.',
    });
  }
  try {
    const summary = await metaEmbeddedSignupService.connect(req.merchant!.merchantId, code, businessId);
    await metaTemplateService.submitAll(req.merchant!.merchantId); // fire-and-forget approval
    res.json(summary);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.get('/whatsapp/templates/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await metaTemplateService.pollStatus(req.merchant!.merchantId)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Self-serve proof: send a real rescue to the merchant's own number.
router.post('/whatsapp/test-pulse', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const m = await Merchant.findById(req.merchant!.merchantId);
  if (!m) return res.status(404).json({ error: 'not found' });
  const phone = (m as any).ownerPhone;
  if (!phone) return res.status(400).json({ error: 'Set your mobile number first (for test messages).' });
  try {
    await whatsAppService.sendTemplate(phone, 'rs_test_pulse_en', 'en', [{ type: 'body', parameters: [{ type: 'text', text: (m as any).storeName || 'your store' }] }], (m as any).whatsappConfig);
    await Merchant.findByIdAndUpdate(m._id, { $set: { 'onboarding.testRescueSentAt': new Date() } });
    res.json({ ok: true, to: phone });
  } catch (e: any) {
    // Surface Meta's exact reason (often opt-in) so the merchant can self-fix.
    res.status(400).json({ error: e.message, hint: 'If Meta says the number is not opted in, send any message to your new WhatsApp Business number from this phone first, then retry.' });
  }
});

// ── Carrier ──
router.post('/carrier', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await carrierConnectService.validateAndSave(req.merchant!.merchantId, req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Payment ──
router.post('/payment', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { gateway, keyId, keySecret } = req.body;
  if (!gateway || !keyId || !keySecret) return res.status(400).json({ error: 'gateway, keyId, keySecret required' });
  try { res.json(await paymentConnectService.validateAndSave(req.merchant!.merchantId, gateway, keyId, keySecret)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Assisted setup: merchant asks the rescue team to set them up on a call ──
router.post('/assisted-setup/request', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const m = await Merchant.findById(req.merchant!.merchantId);
    if (!m) return res.status(404).json({ error: 'not found' });

    // Idempotent: re-request just refreshes the timestamp (owner sees latest intent)
    const firstTime = !(m as any).onboarding?.assistedSetupRequestedAt;
    await Merchant.findByIdAndUpdate(m._id, {
      $set: { 'onboarding.assistedSetupRequestedAt': new Date() },
    });

    if (firstTime) {
      await emailService.notifyOwner('Guided setup requested', {
        merchant: m.name,
        email: m.email,
        merchantId: m._id.toString(),
        phone: (m as any).ownerPhone || 'not set',
        note: 'Merchant asked for hands-on setup. Contact them or wait for their booking.',
      });
    }

    res.json({ ok: true, setupCallUrl: process.env.SETUP_CALL_URL || null });
  } catch (e: any) {
    logger.error('assisted-setup request failed', { error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// ── Owner phone (for the test pulse) + finalize ──
router.post('/owner-phone', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { ownerPhone, storeName } = req.body;
  // MED-1 fix: Validate phone format (E.164: +countrycode followed by 7-14 digits)
  if (ownerPhone && !/^\+\d{7,15}$/.test(ownerPhone)) {
    return res.status(400).json({ error: 'Invalid phone number format. Use E.164 format, e.g. +919876543210' });
  }
  await Merchant.findByIdAndUpdate(req.merchant!.merchantId, { $set: { ownerPhone, ...(storeName ? { storeName } : {}) } });
  res.json({ ok: true });
});
router.post('/finalize', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const m = await Merchant.findById(req.merchant!.merchantId);
  const c = (m as any).connections || {};
  const plan = (m as any).billing?.plan;
  const paid = !!plan && plan !== 'free_trial';

  if (!['shopify', 'whatsapp', 'carrier', 'payment'].every((k) => c[k]?.status === 'connected'))
    return res.status(400).json({ error: 'All four connections must be green to go live.' });
  if (!paid)
    return res.status(400).json({ error: 'Subscribe to a plan to go live.', next: '/billing' });

  // Phase 3: Sandbox graduation check
  const sandboxEligible = sandboxService.isLiveEligible(m as any);
  if (!sandboxEligible) {
    return res.status(400).json({
      error: 'Sandbox not graduated. Complete 3 successful test rescues or manually graduate from the Sandbox page.',
      code: 'SANDBOX_NOT_GRADUATED',
    });
  }

  await Merchant.findByIdAndUpdate(m!._id, {
    $set: {
      'onboarding.completedAt': new Date(),
      'onboarding.currentStep': 'done',
      'onboarding.status': 'completed',
      onboardingStatus: 'completed',
      'sandbox.enabled': false, // auto-disable sandbox on go-live
    },
  });
  res.json({ ok: true });
});

// Merchant bails on the wizard — let them into the dashboard anyway.
// They can always come back: /onboarding stays reachable and everything is resumable.
router.post('/skip', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant!.merchantId, {
      $set: {
        onboardingStatus: 'skipped',
        'onboarding.currentStep': 'skipped',
        'onboarding.status': 'in_progress', // spine resume point — not abandoned
      },
    });
    res.json({ ok: true, onboardingStatus: 'skipped' });
  } catch (e: any) {
    logger.error('skip onboarding failed', { error: e.message });
    res.status(400).json({ error: e.message });
  }
});

export default router;
