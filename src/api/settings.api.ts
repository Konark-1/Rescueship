import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { credentialValidationLimiter } from '../middleware/rateLimiter';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { validatePolicy } from '../config/rescue-policy';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../config/env';

const router = Router();

/**
 * GET /api/settings
 * Retrieve merchant settings with redacted credentials
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;

  try {
    const merchant = await Merchant.findById(merchantId).select('-password');
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const cleanMerchant = merchant.toObject();

    // Redact sensitive tokens
    if (cleanMerchant.platformConfig?.shopifyAccessToken) {
      cleanMerchant.platformConfig.shopifyAccessToken = '********';
    }
    if (cleanMerchant.platformConfig?.woocommerceKey) {
      cleanMerchant.platformConfig.woocommerceKey = '********';
    }
    if (cleanMerchant.platformConfig?.woocommerceSecret) {
      cleanMerchant.platformConfig.woocommerceSecret = '********';
    }
    if ((cleanMerchant.carrierConfig as any)?.apiToken) {
      (cleanMerchant.carrierConfig as any).apiToken = '********';
    }
    if ((cleanMerchant.carrierConfig as any)?.apiKey) {
      (cleanMerchant.carrierConfig as any).apiKey = '********';
    }
    if ((cleanMerchant.carrierConfig as any)?.password) {
      (cleanMerchant.carrierConfig as any).password = '********';
    }
    if (cleanMerchant.whatsappConfig?.accessToken) {
      cleanMerchant.whatsappConfig.accessToken = '********';
    }
    if (cleanMerchant.paymentConfig?.keyId) {
      cleanMerchant.paymentConfig.keyId = '********';
    }
    if (cleanMerchant.paymentConfig?.keySecret) {
      cleanMerchant.paymentConfig.keySecret = '********';
    }

    res.status(200).json(cleanMerchant);
  } catch (err: any) {
    logger.error('Failed to get settings', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

/**
 * PUT /api/settings
 * Update settings and encrypt API credentials
 */
router.put('/', authenticateToken, credentialValidationLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const updates = req.body;

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

    if (updates.platform) {
      merchant.platform = updates.platform;
    }

    if (updates.onboardingStatus) {
      merchant.onboardingStatus = updates.onboardingStatus;
    }

    // Apply platformConfig updates
    const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (updates.platformConfig) {
      merchant.platformConfig = merchant.platformConfig || {};
      if (updates.platformConfig.shopifyDomain) {
        // 🔒 SEC-01 FIX: Strict Domain Validation
        if (!SHOPIFY_DOMAIN_REGEX.test(updates.platformConfig.shopifyDomain)) {
          res.status(400).json({ error: 'Invalid Shopify domain. Must be in format: store.myshopify.com' });
          return;
        }
        merchant.platformConfig.shopifyDomain = updates.platformConfig.shopifyDomain;
      }
      
      const token = updates.platformConfig.shopifyAccessToken;
      if (token && token !== '********') {
        merchant.platformConfig.shopifyAccessToken = encryptionService.encrypt(token);
      }
      
      const wcUrl = updates.platformConfig.woocommerceUrl;
      if (wcUrl) {
        merchant.platformConfig.woocommerceUrl = wcUrl;
      }

      const wcKey = updates.platformConfig.woocommerceKey;
      if (wcKey && wcKey !== '********') {
        merchant.platformConfig.woocommerceKey = encryptionService.encrypt(wcKey);
      }

      const wcSecret = updates.platformConfig.woocommerceSecret;
      if (wcSecret && wcSecret !== '********') {
        merchant.platformConfig.woocommerceSecret = encryptionService.encrypt(wcSecret);
      }
    }

    // Apply carrierConfig updates
    if (updates.carrierConfig) {
      merchant.carrierConfig = merchant.carrierConfig || {};
      const carrierConf = merchant.carrierConfig as any;
      if (updates.carrierConfig.provider) {
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
    }

    // Apply whatsappConfig updates
    if (updates.whatsappConfig) {
      merchant.whatsappConfig = merchant.whatsappConfig || {};
      if (updates.whatsappConfig.phoneNumberId) {
        merchant.whatsappConfig.phoneNumberId = updates.whatsappConfig.phoneNumberId;
      }
      if (updates.whatsappConfig.businessAccountId) {
        merchant.whatsappConfig.businessAccountId = updates.whatsappConfig.businessAccountId;
      }
      
      const waToken = updates.whatsappConfig.accessToken;
      if (waToken && waToken !== '********') {
        merchant.whatsappConfig.accessToken = encryptionService.encrypt(waToken);
      }
    }

    // Apply paymentConfig updates
    if (updates.paymentConfig) {
      merchant.paymentConfig = merchant.paymentConfig || {};
      const provider = updates.paymentConfig.provider || merchant.paymentConfig.provider || 'razorpay';
      if (updates.paymentConfig.provider) {
        merchant.paymentConfig.provider = updates.paymentConfig.provider;
      }
      
      const payId = updates.paymentConfig.keyId;
      const paySecret = updates.paymentConfig.keySecret;
      
      const isUpdatingPayId = payId && payId !== '********';
      const isUpdatingPaySecret = paySecret && paySecret !== '********';

      if (isUpdatingPayId || isUpdatingPaySecret) {
        const testId = isUpdatingPayId ? payId : (merchant.paymentConfig.keyId ? encryptionService.decrypt(merchant.paymentConfig.keyId) : '');
        const testSecret = isUpdatingPaySecret ? paySecret : (merchant.paymentConfig.keySecret ? encryptionService.decrypt(merchant.paymentConfig.keySecret) : '');
        
        if (testId && testSecret) {
          try {
            if (provider === 'razorpay') {
              const auth = Buffer.from(`${testId}:${testSecret}`).toString('base64');
              await axios.get('https://api.razorpay.com/v1/orders', {
                headers: { Authorization: `Basic ${auth}` }
              });
            } else if (provider === 'cashfree') {
              const isProd = config.server.nodeEnv === 'production';
              const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
              await axios.get(`${baseUrl}/orders`, {
                headers: { 
                  'x-client-id': testId, 
                  'x-client-secret': testSecret, 
                  'x-api-version': '2023-08-01' 
                }
              });
            }
          } catch (error: any) {
            if (error.response && error.response.status === 401) {
              res.status(400).json({ error: 'Invalid Payment API Key or Secret provided.' });
              return;
            }
          }
        }
      }

      if (isUpdatingPayId) {
        merchant.paymentConfig.keyId = encryptionService.encrypt(payId);
      }
      if (isUpdatingPaySecret) {
        merchant.paymentConfig.keySecret = encryptionService.encrypt(paySecret);
      }
    }

    // Apply general settings updates
    if (updates.settings) {
      // MED-3 fix: Whitelist allowed setting fields to prevent arbitrary injection
      const allowedCodFields = ['enabled', 'incentiveType', 'incentiveAmount', 'minOrderValue', 'maxOrderValue', 'messageTemplate', 'expiryMinutes'];
      const allowedNdrFields = ['enabled', 'escalationChain', 'maxAttempts', 'autoReschedule', 'returnCoupon', 'addressCorrectionMode'];

      if (updates.settings.codConversion) {
        const filtered: Record<string, any> = {};
        for (const key of allowedCodFields) {
          if (key in updates.settings.codConversion) filtered[key] = updates.settings.codConversion[key];
        }
        merchant.settings.codConversion = {
          ...merchant.settings.codConversion,
          ...filtered,
        };
      }
      if (updates.settings.ndrRescue) {
        const filtered: Record<string, any> = {};
        for (const key of allowedNdrFields) {
          if (key in updates.settings.ndrRescue) filtered[key] = updates.settings.ndrRescue[key];
        }
        merchant.settings.ndrRescue = {
          ...merchant.settings.ndrRescue,
          ...filtered,
        };
      }
    }

    await merchant.save();
    logger.info('Merchant settings updated successfully', { merchantId });

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (err: any) {
    logger.error('Failed to update settings', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
