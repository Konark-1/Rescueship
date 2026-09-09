import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { credentialValidationLimiter } from '../middleware/rateLimiter';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { validatePolicy } from '../config/rescue-policy';
import { logger } from '../utils/logger';
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { generateCarrierWebhookSecret } from '../webhooks/carrier-auth';

const router = Router();

/**
 * GET /api/settings
 * Retrieve merchant settings with redacted credentials
 */
const MASK = '********';
/** `true` → field is present (masked); never returns the stored value (even ciphertext). */
const present = (v: unknown) => (v ? MASK : undefined);

/**
 * Allowlist DTO: only fields the dashboard needs. Anything not listed here
 * (onboarding tokens, custom API secret, Shopify tokens, encrypted creds…)
 * is never serialised, regardless of what gets added to the model later.
 */
function toSettingsDto(m: any) {
  const pc = m.platformConfig || {};
  const cc = m.carrierConfig || {};
  const wc = m.whatsappConfig || {};
  const pay = m.paymentConfig || {};
  const b = m.billing || {};
  return {
    _id: m._id,
    name: m.name,
    email: m.email,
    platform: m.platform,
    onboardingStatus: m.onboardingStatus,
    storeName: m.storeName,
    ownerPhone: m.ownerPhone,
    hasPassword: !!m.password,
    hasGoogleAuth: !!m.googleId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    platformConfig: {
      shopifyDomain: pc.shopifyDomain,
      shopifyAccessToken: present(pc.shopifyAccessToken),
      woocommerceUrl: pc.woocommerceUrl,
      woocommerceKey: present(pc.woocommerceKey),
      woocommerceSecret: present(pc.woocommerceSecret),
      customApiSecret: present(pc.customApiSecret),
      customWebhookUrl: pc.customWebhookUrl,
    },
    carrierConfig: {
      provider: cc.provider,
      apiToken: present(cc.apiToken),
      apiKey: present(cc.apiKey),
      email: present(cc.email),
      password: present(cc.password),
      webhookSecret: present(cc.webhookSecret),
    },
    whatsappConfig: {
      phoneNumberId: wc.phoneNumberId,
      businessAccountId: wc.businessAccountId,
      accessToken: present(wc.accessToken),
      templates: wc.templates,
    },
    paymentConfig: {
      provider: pay.provider || pay.gateway,
      keyId: present(pay.keyId),
      keySecret: present(pay.keySecret),
      webhookSecret: present(pay.webhookSecret),
    },
    settings: m.settings,
    rescuePolicy: m.rescuePolicy,
    connections: m.connections,
    shopify: m.shopify ? { shopDomain: m.shopify.shopDomain, webhooksRegistered: m.shopify.webhooksRegistered, demo: m.shopify.demo } : undefined,
    billing: {
      plan: b.plan,
      billingCycle: b.billingCycle,
      status: b.status,
      planOrderLimit: b.planOrderLimit,
      currentMonthOrders: b.currentMonthOrders,
      cycleStartDate: b.cycleStartDate,
      rescueCredits: b.rescueCredits,
      totalRescues: b.totalRescues,
      totalConversions: b.totalConversions,
      activatedAt: b.activatedAt,
      nextInvoiceDate: b.nextInvoiceDate,
      renewMonthly: b.renewMonthly,
    },
    sandbox: m.sandbox,
    quality: m.quality,
    metrics: m.metrics,
  };
}

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;

  try {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    res.status(200).json(toSettingsDto(merchant));
  } catch (err: any) {
    logger.error('Failed to get settings', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

/**
 * PUT /api/settings
 * Update settings and encrypt API credentials
 */
/**
 * Only credential changes hit an outbound gateway to validate, so only those
 * requests should consume the strict credential-validation budget. Toggling a
 * switch or editing the rescue policy must never lock a merchant out for 15 min.
 */
const CREDENTIAL_KEYS: Array<[string, string[]]> = [
  ['platformConfig', ['shopifyAccessToken', 'shopifyApiSecret', 'woocommerceKey', 'woocommerceSecret']],
  ['carrierConfig', ['apiToken', 'apiKey', 'password', 'email']],
  ['whatsappConfig', ['accessToken', 'phoneNumberId']],
  ['paymentConfig', ['keyId', 'keySecret', 'webhookSecret']],
];
function touchesCredentials(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  return CREDENTIAL_KEYS.some(([section, keys]) => {
    const s = body[section];
    return s && typeof s === 'object' && keys.some((k) => typeof s[k] === 'string' && s[k].length > 0 && s[k] !== '********');
  });
}
const limitOnlyCredentialChanges = (req: AuthenticatedRequest, res: Response, next: () => void) =>
  touchesCredentials(req.body) ? credentialValidationLimiter(req, res, next) : next();

router.put('/', authenticateToken, limitOnlyCredentialChanges, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const updates = req.body ?? {};

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    if (updates.rescuePolicy) {
      const errs = validatePolicy(updates.rescuePolicy);
      if (errs.length > 0) {
        res.status(400).json({ error: 'Invalid rescue policy', details: errs });
        return;
      }
      merchant.rescuePolicy = updates.rescuePolicy;
    }

    if (updates.platform !== undefined) {
      if (!['shopify', 'woocommerce', 'custom'].includes(updates.platform)) {
        res.status(400).json({ error: 'Invalid platform' });
        return;
      }
      merchant.platform = updates.platform;
    }

    if (updates.onboardingStatus !== undefined) {
      if (!['pending', 'skipped', 'completed'].includes(updates.onboardingStatus)) {
        res.status(400).json({ error: 'Invalid onboardingStatus' });
        return;
      }
      merchant.onboardingStatus = updates.onboardingStatus;
    }

    const isSecretStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1024 && v !== '********';

    // Apply platformConfig updates
    const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (updates.platformConfig) {
      merchant.platformConfig = merchant.platformConfig || {};
      if (updates.platformConfig.shopifyDomain) {
        const dom = String(updates.platformConfig.shopifyDomain).toLowerCase().trim();
        // 🔒 SEC-01 FIX: Strict Domain Validation
        if (!SHOPIFY_DOMAIN_REGEX.test(dom)) {
          res.status(400).json({ error: 'Invalid Shopify domain. Must be in format: store.myshopify.com' });
          return;
        }
        // Store domain is the webhook tenant key — it must be unique across merchants.
        const other = await Merchant.findOne({ _id: { $ne: merchant._id }, $or: [{ 'platformConfig.shopifyDomain': dom }, { 'shopify.shopDomain': dom }] }).select('_id');
        if (other) {
          res.status(409).json({ error: 'This Shopify store is already connected to another account.' });
          return;
        }
        merchant.platformConfig.shopifyDomain = dom;
      }
      
      const token = updates.platformConfig.shopifyAccessToken;
      if (isSecretStr(token)) {
        merchant.platformConfig.shopifyAccessToken = encryptionService.encrypt(token);
      }
      
      const wcUrl = updates.platformConfig.woocommerceUrl;
      if (wcUrl !== undefined && wcUrl !== '') {
        let parsed: URL;
        try { parsed = new URL(String(wcUrl)); } catch { parsed = null as any; }
        if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) {
          res.status(400).json({ error: 'woocommerceUrl must be a valid https:// URL' });
          return;
        }
        merchant.platformConfig.woocommerceUrl = parsed.origin + parsed.pathname.replace(/\/$/, '');
      }

      const wcKey = updates.platformConfig.woocommerceKey;
      if (isSecretStr(wcKey)) {
        merchant.platformConfig.woocommerceKey = encryptionService.encrypt(wcKey);
      }

      const wcSecret = updates.platformConfig.woocommerceSecret;
      if (isSecretStr(wcSecret)) {
        merchant.platformConfig.woocommerceSecret = encryptionService.encrypt(wcSecret);
      }

      // Custom-app API secret key: needed so inbound Shopify webhooks for a manually
      // configured store can be HMAC-verified against THIS merchant's app.
      const shopifyApiSecret = updates.platformConfig.shopifyApiSecret;
      if (isSecretStr(shopifyApiSecret)) {
        (merchant as any).shopify = {
          ...((merchant as any).shopify || {}),
          shopDomain: (merchant as any).shopify?.shopDomain || merchant.platformConfig.shopifyDomain,
          apiSecret: encryptionService.encrypt(shopifyApiSecret),
        };
        merchant.markModified('shopify');
      }
      merchant.markModified('platformConfig');
    }

    // Apply carrierConfig updates
    if (updates.carrierConfig) {
      merchant.carrierConfig = merchant.carrierConfig || {};
      const carrierConf = merchant.carrierConfig as any;
      if (updates.carrierConfig.provider !== undefined) {
        if (!['shiprocket', 'clickpost', 'delhivery'].includes(updates.carrierConfig.provider)) {
          res.status(400).json({ error: 'Invalid carrier provider' });
          return;
        }
        carrierConf.provider = updates.carrierConfig.provider;
      }
      
      const carrierToken = updates.carrierConfig.apiToken;
      if (carrierToken && carrierToken !== '********') {
        carrierConf.apiToken = encryptionService.encrypt(carrierToken);
      }

      const carrierApiKey = updates.carrierConfig.apiKey;
      if (carrierApiKey && carrierApiKey !== '********') {
        carrierConf.apiKey = encryptionService.encrypt(carrierApiKey);
      }

      const carrierPass = updates.carrierConfig.password;
      if (carrierPass && carrierPass !== '********') {
        carrierConf.password = encryptionService.encrypt(carrierPass);
      }

      const carrierEmail = updates.carrierConfig.email;
      if (carrierEmail && carrierEmail !== '********') {
        carrierConf.email = encryptionService.encrypt(carrierEmail);
      }
      merchant.markModified('carrierConfig');
    }

    // Apply whatsappConfig updates
    if (updates.whatsappConfig) {
      merchant.whatsappConfig = merchant.whatsappConfig || {};
      const wa = updates.whatsappConfig;
      const newPhoneNumberId = wa.phoneNumberId !== undefined ? String(wa.phoneNumberId).trim() : undefined;
      const newBusinessAccountId = wa.businessAccountId !== undefined ? String(wa.businessAccountId).trim() : undefined;
      const waToken = wa.accessToken;

      if (newPhoneNumberId !== undefined && !/^\d{6,32}$/.test(newPhoneNumberId)) {
        res.status(400).json({ error: 'Invalid WhatsApp phoneNumberId' });
        return;
      }
      if (newBusinessAccountId !== undefined && !/^\d{6,32}$/.test(newBusinessAccountId)) {
        res.status(400).json({ error: 'Invalid WhatsApp businessAccountId' });
        return;
      }

      // Inbound WhatsApp is routed to the tenant by phoneNumberId, so a merchant must PROVE
      // ownership before claiming one: the supplied/stored access token must be able to
      // read that phone number from Meta. This blocks inbound-routing hijack and connect-DoS.
      if (newPhoneNumberId && newPhoneNumberId !== merchant.whatsappConfig.phoneNumberId) {
        let tokenToCheck: string | undefined;
        if (isSecretStr(waToken)) tokenToCheck = waToken;
        else if (merchant.whatsappConfig.accessToken) {
          try { tokenToCheck = encryptionService.decrypt(merchant.whatsappConfig.accessToken); } catch { tokenToCheck = undefined; }
        }
        if (!tokenToCheck) {
          res.status(400).json({ error: 'A WhatsApp access token is required to change the phone number ID.' });
          return;
        }
        try {
          await axios.get(`https://graph.facebook.com/${config.whatsapp.apiVersion}/${encodeURIComponent(newPhoneNumberId)}`, {
            headers: { Authorization: `Bearer ${tokenToCheck}` },
            params: { fields: 'id,display_phone_number' },
            timeout: 8000,
          });
        } catch (e: any) {
          logger.warn('WhatsApp phoneNumberId ownership check failed', { merchantId, status: e.response?.status });
          res.status(400).json({ error: 'Could not verify that this access token owns the given WhatsApp phone number ID.' });
          return;
        }
        const other = await Merchant.findOne({ _id: { $ne: merchant._id }, 'whatsappConfig.phoneNumberId': newPhoneNumberId }).select('_id');
        if (other) {
          res.status(409).json({ error: 'This WhatsApp number is already connected to another account.' });
          return;
        }
        merchant.whatsappConfig.phoneNumberId = newPhoneNumberId;
      }
      if (newBusinessAccountId) merchant.whatsappConfig.businessAccountId = newBusinessAccountId;
      if (isSecretStr(waToken)) merchant.whatsappConfig.accessToken = encryptionService.encrypt(waToken);
      merchant.markModified('whatsappConfig');
    }

    // Apply paymentConfig updates
    if (updates.paymentConfig) {
      merchant.paymentConfig = merchant.paymentConfig || {};
      if (updates.paymentConfig.provider !== undefined && !['razorpay', 'cashfree'].includes(updates.paymentConfig.provider)) {
        res.status(400).json({ error: 'Invalid payment provider' });
        return;
      }
      const provider = updates.paymentConfig.provider || merchant.paymentConfig.provider || (merchant.paymentConfig as any).gateway || 'razorpay';
      if (updates.paymentConfig.provider) {
        merchant.paymentConfig.provider = updates.paymentConfig.provider;
        (merchant.paymentConfig as any).gateway = updates.paymentConfig.provider;
      }
      const payWebhookSecret = updates.paymentConfig.webhookSecret;
      if (isSecretStr(payWebhookSecret)) {
        (merchant.paymentConfig as any).webhookSecret = encryptionService.encrypt(payWebhookSecret);
      }
      
      const payId = updates.paymentConfig.keyId;
      const paySecret = updates.paymentConfig.keySecret;
      
      const isUpdatingPayId = isSecretStr(payId);
      const isUpdatingPaySecret = isSecretStr(paySecret);

      if (isUpdatingPayId || isUpdatingPaySecret) {
        let testId = '', testSecret = '';
        try {
          testId = isUpdatingPayId ? payId : (merchant.paymentConfig.keyId ? encryptionService.decrypt(merchant.paymentConfig.keyId) : '');
          testSecret = isUpdatingPaySecret ? paySecret : (merchant.paymentConfig.keySecret ? encryptionService.decrypt(merchant.paymentConfig.keySecret) : '');
        } catch {
          res.status(400).json({ error: 'Stored payment credentials are unreadable. Please provide both key ID and secret.' });
          return;
        }

        if (!testId || !testSecret) {
          res.status(400).json({ error: 'Both payment key ID and secret are required.' });
          return;
        }

        // Validate live against the gateway; fail closed if we cannot confirm the pair works.
        try {
          if (provider === 'razorpay') {
            const auth = Buffer.from(`${testId}:${testSecret}`).toString('base64');
            await axios.get('https://api.razorpay.com/v1/orders', { headers: { Authorization: `Basic ${auth}` }, params: { count: 1 }, timeout: 8000 });
          } else {
            const isProd = config.server.nodeEnv === 'production';
            const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
            await axios.get(`${baseUrl}/orders`, {
              headers: { 'x-client-id': testId, 'x-client-secret': testSecret, 'x-api-version': '2023-08-01' },
              timeout: 8000,
            });
          }
        } catch (error: any) {
          const sc = error.response?.status;
          if (sc === 401 || sc === 403) {
            res.status(400).json({ error: 'Invalid Payment API Key or Secret provided.' });
            return;
          }
          logger.warn('Payment credential validation unavailable', { merchantId, provider, status: sc, code: error.code });
          res.status(503).json({ error: 'Could not reach the payment gateway to validate credentials. Please try again.' });
          return;
        }
      }

      if (isUpdatingPayId) {
        merchant.paymentConfig.keyId = encryptionService.encrypt(payId);
      }
      if (isUpdatingPaySecret) {
        merchant.paymentConfig.keySecret = encryptionService.encrypt(paySecret);
      }
      merchant.markModified('paymentConfig');
    }

      // Apply general settings updates
    if (updates.settings) {
      // MED-3 fix: Whitelist allowed setting fields to prevent arbitrary injection
      const allowedCodFields = ['enabled', 'incentiveType', 'incentiveAmount', 'minOrderValue', 'maxOrderValue', 'messageTemplate', 'expiryMinutes'];
      const allowedNdrFields = ['enabled', 'escalationChain', 'maxAttempts', 'autoReschedule', 'returnCoupon', 'addressCorrectionMode'];

      // AI provider preference
      if (updates.settings.aiProvider) {
        if (!['kieAi', 'gemini'].includes(updates.settings.aiProvider)) {
          res.status(400).json({ error: 'Invalid aiProvider. Must be "kieAi" or "gemini".' });
          return;
        }
        (merchant.settings as any).aiProvider = updates.settings.aiProvider;
      }

      const isNum = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

      if (updates.settings.codConversion) {
        const c = updates.settings.codConversion;
        if ('enabled' in c && typeof c.enabled !== 'boolean') { res.status(400).json({ error: 'codConversion.enabled must be boolean' }); return; }
        if ('incentiveType' in c && !['flat', 'percentage'].includes(c.incentiveType)) { res.status(400).json({ error: 'Invalid incentiveType' }); return; }
        if ('incentiveAmount' in c && !isNum(c.incentiveAmount, 0, 100000)) { res.status(400).json({ error: 'Invalid incentiveAmount' }); return; }
        if ('minOrderValue' in c && !isNum(c.minOrderValue, 0, 10000000)) { res.status(400).json({ error: 'Invalid minOrderValue' }); return; }
        if ('maxOrderValue' in c && !isNum(c.maxOrderValue, 0, 10000000)) { res.status(400).json({ error: 'Invalid maxOrderValue' }); return; }
        if ('expiryMinutes' in c && !isNum(c.expiryMinutes, 5, 10080)) { res.status(400).json({ error: 'Invalid expiryMinutes' }); return; }
        if ('messageTemplate' in c && (typeof c.messageTemplate !== 'string' || c.messageTemplate.length > 1024)) { res.status(400).json({ error: 'Invalid messageTemplate' }); return; }
        const filtered: Record<string, any> = {};
        for (const key of allowedCodFields) {
          if (key in c) filtered[key] = c[key];
        }
        merchant.settings.codConversion = {
          ...merchant.settings.codConversion,
          ...filtered,
        };
      }
      if (updates.settings.ndrRescue) {
        const n = updates.settings.ndrRescue;
        if ('enabled' in n && typeof n.enabled !== 'boolean') { res.status(400).json({ error: 'ndrRescue.enabled must be boolean' }); return; }
        if ('escalationChain' in n && (!Array.isArray(n.escalationChain) || n.escalationChain.length > 10 || !n.escalationChain.every((h: unknown) => isNum(h, 1, 720)))) {
          res.status(400).json({ error: 'escalationChain must be an array of 1-10 hour offsets (1-720)' }); return;
        }
        if ('maxAttempts' in n && !isNum(n.maxAttempts, 1, 10)) { res.status(400).json({ error: 'Invalid maxAttempts' }); return; }
        if ('returnCoupon' in n && (typeof n.returnCoupon !== 'string' || n.returnCoupon.length > 64)) { res.status(400).json({ error: 'Invalid returnCoupon' }); return; }
        const filtered: Record<string, any> = {};
        for (const key of allowedNdrFields) {
          if (key in n) filtered[key] = n[key];
        }
        merchant.settings.ndrRescue = {
          ...merchant.settings.ndrRescue,
          ...filtered,
        };
      }
      merchant.markModified('settings');
    }

    await merchant.save();
    logger.info('Merchant settings updated successfully', { merchantId });

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (err: any) {
    logger.error('Failed to update settings', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * POST /api/settings/custom-api-secret/rotate
 * Generates (or rotates) the Bearer token a custom-platform store must send to
 * POST /webhooks/custom/order-created?merchant_id=<id>. The plaintext is returned
 * exactly once; only the encrypted form is stored.
 */
router.post('/custom-api-secret/rotate', authenticateToken, credentialValidationLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) { res.status(404).json({ error: 'Merchant not found' }); return; }
    const secret = crypto.randomBytes(32).toString('base64url');
    merchant.platformConfig = merchant.platformConfig || {};
    merchant.platformConfig.customApiSecret = encryptionService.encrypt(secret);
    merchant.markModified('platformConfig');
    await merchant.save();
    logger.info('Custom API secret rotated', { merchantId });
    res.status(200).json({
      secret,
      webhookUrl: `${(process.env.API_PUBLIC_URL || config.server.apiBaseUrl).replace(/\/$/, '')}/webhooks/custom/order-created?merchant_id=${merchant._id}`,
      note: 'Store this token now. It will not be shown again.',
    });
  } catch (err: any) {
    logger.error('Failed to rotate custom API secret', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to rotate secret' });
  }
});

/**
 * POST /api/settings/carrier-webhook-secret/rotate
 * Generates (or rotates) the per-merchant secret a carrier panel must present
 * (x-api-key / Authorization: Bearer, or x-<carrier>-signature HMAC) when calling
 * POST /webhooks/<carrier>/ndr?merchant_id=<id>. Returned in plaintext once.
 */
router.post('/carrier-webhook-secret/rotate', authenticateToken, credentialValidationLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) { res.status(404).json({ error: 'Merchant not found' }); return; }
    const secret = generateCarrierWebhookSecret();
    const cc: any = merchant.carrierConfig || {};
    merchant.carrierConfig = { ...cc, webhookSecret: encryptionService.encrypt(secret) };
    merchant.markModified('carrierConfig');
    await merchant.save();
    const base = (process.env.API_PUBLIC_URL || config.server.apiBaseUrl).replace(/\/$/, '');
    logger.info('Carrier webhook secret rotated', { merchantId, provider: cc.provider });
    res.status(200).json({
      secret,
      webhookUrls: {
        shiprocket: `${base}/webhooks/shiprocket/ndr?merchant_id=${merchant._id}`,
        delhivery: `${base}/webhooks/delhivery/ndr?merchant_id=${merchant._id}`,
        clickpost: `${base}/webhooks/clickpost/ndr?merchant_id=${merchant._id}`,
      },
      note: 'Store this secret now. It will not be shown again.',
    });
  } catch (err: any) {
    logger.error('Failed to rotate carrier webhook secret', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to rotate secret' });
  }
});

/**
 * GET /api/settings/ai-providers
 * Returns which AI providers are configured (server-level env vars) and the merchant's active choice.
 */
router.get('/ai-providers', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const merchant = await Merchant.findById(merchantId).lean();
    res.status(200).json({
      providers: {
        kieAi: !!process.env.KIE_AI_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
      },
      activeProvider: (merchant?.settings as any)?.aiProvider || 'kieAi',
    });
  } catch (err: any) {
    logger.error('Failed to get AI providers', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve AI providers' });
  }
});

export default router;
