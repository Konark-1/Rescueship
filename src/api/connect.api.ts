/**
 * connect.api.ts — the self-serve integration surface.
 * Everything a merchant needs to wire themselves, with live state.
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { metaEmbeddedSignupService } from '../services/meta-embedded-signup.service';
import { metaTemplateService } from '../services/meta-template.service';
import { shopifyOAuthService } from '../services/shopify-oauth.service';
import { woocommerceConnectService } from '../services/woocommerce-connect.service';
import { carrierConnectService } from '../services/carrier-connect.service';
import { paymentConnectService } from '../services/payment-connect.service';
import { whatsAppService } from '../services/whatsapp.service';
import { sandboxService } from '../services/sandbox.service';
import { emailService } from '../services/email.service';
import { encryptionService } from '../services/encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';
import { standardMerchantLimiter } from '../middleware/merchant-rate-limiter';
import { frontendOrigin } from '../config/env';
import { credentialValidationLimiter } from '../middleware/rateLimiter';

const router = Router();

// The spine state the wizard renders.
router.get('/state', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const m = await Merchant.findById(req.merchant!.merchantId).lean();
    const c = (m as any).connections || {};
    // The "store" requirement is platform-agnostic: Shopify OR WooCommerce (either path
    // counts as the store being wired). The other three stations are always required.
    const storeConnected = c.shopify?.status === 'connected' || c.woocommerce?.status === 'connected';
    const allGreen = storeConnected && ['whatsapp', 'carrier', 'payment'].every((k) => c[k]?.status === 'connected');
    res.json({
      storeName: (m as any).storeName || (m as any).shopify?.shopDomain || null,
      ownerPhone: (m as any).ownerPhone || null,
      connections: {
        shopify: c.shopify || { status: 'disconnected' },
        woocommerce: c.woocommerce || { status: 'disconnected' },
        whatsapp: {
          ...(c.whatsapp || { status: 'disconnected' }),
          phoneNumberId: (m as any).whatsappConfig?.phoneNumberId || null,
          wabaId: (m as any).whatsappConfig?.wabaId || null,
        },
        carrier: c.carrier || { status: 'disconnected' },
        payment: c.payment || { status: 'disconnected' },
      },
        templates: (m as any).whatsappConfig?.templates || [],
      onboarding: (m as any).onboarding || { completedAt: null },
      ready: allGreen,
      // Which store-connect paths this deployment can offer right now
      capabilities: {
        shopifyOAuth: shopifyOAuthService.isConfigured(),
        shopifyToken: true,
        shopifyDemo: shopifyOAuthService.isDemoAvailable(),
        woocommerce: true,
        whatsappEmbedded: !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_CONFIG_ID),
      },
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
  try {
    const rawOrigin = req.get('origin') || req.get('referer');
    let origin: string | undefined = undefined;
    if (rawOrigin) {
      try { origin = new URL(rawOrigin).origin; } catch { origin = rawOrigin; }
    }
    res.json({ url: shopifyOAuthService.authorizeUrl(req.merchant!.merchantId, shop, origin) });
  }
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

// Direct API token path — merchant pastes their store's Admin API access token.
// Works everywhere (dev or prod), no Partner app required from anyone.
router.post('/shopify/token', authenticateToken, credentialValidationLimiter, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { shop, accessToken, apiSecret } = req.body;
  if (typeof shop !== 'string' || typeof accessToken !== 'string' || typeof apiSecret !== 'string') {
    return res.status(400).json({ error: 'shop, accessToken and apiSecret required' });
  }
  try { res.json(await shopifyOAuthService.connectWithToken(req.merchant!.merchantId, shop, accessToken, apiSecret)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});
// Hit by Shopify (no JWT) — verifies hmac+state, then bounces the browser to the wizard.
router.get('/shopify/callback', async (req: Request, res: Response) => {
  let targetOrigin = frontendOrigin();
  try {
    if (req.query.state && typeof req.query.state === 'string') {
      try {
        const decoded = jwt.decode(req.query.state) as any;
        if (decoded?.returnOrigin) targetOrigin = decoded.returnOrigin;
      } catch { /* ignore */ }
    }
    const result = await shopifyOAuthService.handleCallback(req.query as Record<string, string>);
    if (result?.returnOrigin) targetOrigin = result.returnOrigin;
    logger.info('Shopify OAuth handshake successful', { shop: result.shop, targetOrigin });
    res.redirect(`${targetOrigin}/onboarding?connected=shopify`);
  } catch (e: any) {
    logger.error('Shopify callback failed', { error: e.message });
    res.redirect(`${targetOrigin}/onboarding?error=shopify`);
  }
});

// GET /api/connect/shopify/metrics — pulls order analytics for the billing loss calculator
router.get('/shopify/metrics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const m = await Merchant.findById(merchantId).lean();
    const shopify = (m as any)?.shopify;
    const connected = (m as any)?.connections?.shopify?.status === 'connected';

    if (!connected || !shopify) {
      return res.json({ available: false });
    }

    const { Order: OrderModel } = await import('../models');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const recentOrders = await OrderModel.find({
      merchantId,
      createdAt: { $gte: thirtyDaysAgo },
    }).select('orderValue paymentMethod').lean();

    if (recentOrders.length > 0) {
      const totalOrders = recentOrders.length;
      const totalVal = recentOrders.reduce((sum: number, o: any) => sum + (Number(o.orderValue) || 0), 0);
      const aov = Math.round(totalVal / totalOrders) || 1200;
      const codOrders = recentOrders.filter((o: any) => /cod|cash/i.test(o.paymentMethod || '')).length;
      const codPct = +(codOrders / totalOrders).toFixed(2) || 0.70;
      return res.json({ available: true, monthlyOrders: totalOrders, aov, codPct, storeDomain: shopify.shopDomain });
    }

    return res.json({
      available: true,
      monthlyOrders: 850,
      aov: 1350,
      codPct: 0.72,
      storeDomain: shopify.shopDomain,
      estimated: true,
    });
  } catch (e: any) {
    logger.error('Failed to fetch shopify metrics', { error: e.message });
    return res.json({ available: false });
  }
});

// ── Store metrics (platform-agnostic: Shopify OR WooCommerce) ──
// Feeds the billing RTO/loss calculator. Derived from the Order collection, so it
// works identically for WooCommerce and Shopify; store identity just picks the label.
router.get('/store/metrics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const m = await Merchant.findById(merchantId).lean();
    const c = (m as any).connections || {};
    const shopConnected = c.shopify?.status === 'connected';
    const wcConnected = c.woocommerce?.status === 'connected';
    if (!shopConnected && !wcConnected) return res.json({ available: false });

    const storeDomain = shopConnected
      ? (m as any).shopify?.shopDomain || (m as any).platformConfig?.shopifyDomain || 'Shopify'
      : (m as any).connections?.woocommerce?.url || (m as any).platformConfig?.woocommerceUrl || 'WooCommerce';

    const { Order: OrderModel } = await import('../models');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const recentOrders = await OrderModel.find({ merchantId, createdAt: { $gte: thirtyDaysAgo } }).select('orderValue paymentMethod').lean();

    if (recentOrders.length > 0) {
      const totalOrders = recentOrders.length;
      const totalVal = recentOrders.reduce((sum: number, o: any) => sum + (Number(o.orderValue) || 0), 0);
      const aov = Math.round(totalVal / totalOrders) || 1200;
      const codOrders = recentOrders.filter((o: any) => /cod|cash/i.test(o.paymentMethod || '')).length;
      const codPct = Math.max(0, Math.min(1, +(codOrders / totalOrders).toFixed(2)));
      return res.json({ available: true, monthlyOrders: totalOrders, aov, codPct, storeDomain });
    }

    return res.json({ available: true, monthlyOrders: 850, aov: 1350, codPct: 0.72, storeDomain, estimated: true });
  } catch (e: any) {
    logger.error('Failed to fetch store metrics', { error: e.message });
    return res.json({ available: false });
  }
});

// ── WooCommerce ──  (outbound credential validation → strict limiter)
router.post('/woocommerce', authenticateToken, credentialValidationLimiter, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { url, consumerKey, consumerSecret } = req.body;
  if (typeof url !== 'string' || typeof consumerKey !== 'string' || typeof consumerSecret !== 'string' || !url || !consumerKey || !consumerSecret) {
    return res.status(400).json({ error: 'url, consumerKey and consumerSecret required' });
  }
  try { res.json(await woocommerceConnectService.connect(req.merchant!.merchantId, { url, consumerKey, consumerSecret })); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── WhatsApp (Manual connect) ──
// No Meta Embedded Signup / app config needed. The merchant pastes credentials they
// already have from their own Meta Business account (WhatsApp Manager → API setup).
router.post('/whatsapp/manual', authenticateToken, credentialValidationLimiter, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { phoneNumberId, wabaId, accessToken } = req.body;
  if (typeof phoneNumberId !== 'string' || typeof wabaId !== 'string' || typeof accessToken !== 'string' || !phoneNumberId || !wabaId || !accessToken) {
    return res.status(400).json({ error: 'phoneNumberId, wabaId and accessToken required' });
  }
  const phone = phoneNumberId.trim();
  const waba = wabaId.trim();
  const token = accessToken.trim();
  if (!/^\d{6,32}$/.test(phone)) return res.status(400).json({ error: 'Invalid phoneNumberId (numeric ID).' });
  if (!/^\d{6,32}$/.test(waba)) return res.status(400).json({ error: 'Invalid WABA ID (numeric ID).' });

  // Ownership check: the token must read BOTH the phone number and its WABA, so a
  // merchant can never claim a number they don't own (blocks inbound-routing hijack).
  try {
    await axios.get(`https://graph.facebook.com/v22.0/${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${token}` }, params: { fields: 'id,display_phone_number' }, timeout: 8000,
    });
    await axios.get(`https://graph.facebook.com/v22.0/${encodeURIComponent(waba)}`, {
      headers: { Authorization: `Bearer ${token}` }, params: { fields: 'id,name' }, timeout: 8000,
    });
  } catch (e: any) {
    const metaErr = e.response?.data?.error;
    const msg = metaErr?.message || e.message;
    logger.warn('WhatsApp manual credential validation failed', { status: e.response?.status, error: metaErr || e.message });
    return res.status(400).json({
      error: `Could not verify WhatsApp credentials: ${msg}. Check your Phone number ID, WABA ID, and make sure your access token has whatsapp_business_messaging permissions.`,
    });
  }

  const other = await Merchant.findOne({ _id: { $ne: req.merchant!.merchantId }, 'whatsappConfig.phoneNumberId': phone }).select('_id');
  if (other) return res.status(409).json({ error: 'This WhatsApp number is already connected to another account.' });

  const merchant = await Merchant.findById(req.merchant!.merchantId);
  if (!merchant) return res.status(404).json({ error: 'not found' });
  (merchant as any).whatsappConfig = {
    ...((merchant as any).whatsappConfig || {}),
    phoneNumberId: phone,
    wabaId: waba,
    accessToken: encryptionService.encrypt(token),
  };
  (merchant as any).connections = {
    ...((merchant as any).connections || {}),
    whatsapp: { status: 'templates_pending', connectedAt: new Date(), lastError: null },
  };
  await merchant.save();

  // fire-and-forget template submission + approval polling
  void metaTemplateService.submitAll(req.merchant!.merchantId).catch((e: any) => logger.warn('Manual WhatsApp template submit failed', { error: e.message }));

  res.json({ status: 'templates_pending', phoneNumberId: phone, wabaId: waba });
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
router.post('/whatsapp/templates/resubmit', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await metaTemplateService.resubmitAll(req.merchant!.merchantId);
    res.json({ ok: true, templates: results, status: 'templates_pending' });
  } catch (e: any) {
    logger.error('WhatsApp template resubmit failed', { error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// Self-serve proof: send a real rescue to the merchant's own number.
router.post('/whatsapp/test-pulse', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const m = await Merchant.findById(req.merchant!.merchantId);
  if (!m) return res.status(404).json({ error: 'not found' });
  const phone = (m as any).ownerPhone;
  if (!phone) return res.status(400).json({ error: 'Set your mobile number first (for test messages).' });
  const waCfg = (m as any).whatsappConfig;
  if (!waCfg?.phoneNumberId || !waCfg?.accessToken) {
    return res.status(400).json({ error: 'Connect your WhatsApp Business number first.' });
  }
  let decryptedToken: string;
  try { decryptedToken = encryptionService.decrypt(waCfg.accessToken); }
  catch { return res.status(400).json({ error: 'WhatsApp credentials need to be reconnected.' }); }
  try {
    // Always the merchant's own number/token — never the platform WABA.
    await whatsAppService.sendTemplate(
      phone, 'rs_test_pulse_en', 'en',
      [{ type: 'body', parameters: [{ type: 'text', text: (m as any).storeName || 'your store' }] }],
      { phoneNumberId: waCfg.phoneNumberId, accessToken: decryptedToken, businessAccountId: waCfg.businessAccountId, templateMap: waCfg.templateMap } as any
    );
    await Merchant.findByIdAndUpdate(m._id, { $set: { 'onboarding.testRescueSentAt': new Date() } });
    res.json({ ok: true, to: phone });
  } catch (e: any) {
    // Surface Meta's exact reason (often opt-in) so the merchant can self-fix.
    res.status(400).json({ error: e.message, hint: 'If Meta says the number is not opted in, send any message to your new WhatsApp Business number from this phone first, then retry.' });
  }
});

// ── Carrier ──  (outbound credential validation → strict limiter)
router.post('/carrier', authenticateToken, credentialValidationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await carrierConnectService.validateAndSave(req.merchant!.merchantId, req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Per-merchant carrier webhook URL + secret (paste into carrier panel).
router.get('/carrier/webhook', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await carrierConnectService.webhookCredentials(req.merchant!.merchantId)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Payment ──  (outbound credential validation → strict limiter)
router.post('/payment', authenticateToken, credentialValidationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { gateway, keyId, keySecret } = req.body;
  if (typeof gateway !== 'string' || typeof keyId !== 'string' || typeof keySecret !== 'string' || !gateway || !keyId || !keySecret) {
    return res.status(400).json({ error: 'gateway, keyId, keySecret required' });
  }
  if (gateway !== 'razorpay' && gateway !== 'cashfree') {
    return res.status(400).json({ error: 'Unsupported gateway' });
  }
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
      await emailService.notifyMerchant(
        m.email,
        'We got your setup request',
        `Hi ${m.name || 'there'},\n\nWe received your request for a guided setup call. Our team will reach out within 24 hours to walk you through connecting your store, WhatsApp number, and courier — step by step.\n\nIf you'd like to start sooner, reply to this email with your availability.\n\nBest,\nRescueShip`,
      );
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
  if (ownerPhone !== undefined && (typeof ownerPhone !== 'string' || !/^\+\d{7,15}$/.test(ownerPhone))) {
    return res.status(400).json({ error: 'Invalid phone number format. Use E.164 format, e.g. +919876543210' });
  }
  if (storeName !== undefined && (typeof storeName !== 'string' || storeName.length > 120)) {
    return res.status(400).json({ error: 'Invalid store name' });
  }
  await Merchant.findByIdAndUpdate(req.merchant!.merchantId, {
    $set: { ...(ownerPhone ? { ownerPhone } : {}), ...(storeName ? { storeName: storeName.trim() } : {}) },
  });
  res.json({ ok: true });
});
router.post('/finalize', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const m = await Merchant.findById(req.merchant!.merchantId);
  const c = (m as any).connections || {};
  const plan = (m as any).billing?.plan;
  const paid = !!plan && plan !== 'free_trial';

  if (!(c.shopify?.status === 'connected' || c.woocommerce?.status === 'connected') ||
      !['whatsapp', 'carrier', 'payment'].every((k) => c[k]?.status === 'connected'))
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
