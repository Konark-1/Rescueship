import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { Merchant } from '../models';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

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
    if (cleanMerchant.carrierConfig?.apiToken) {
      cleanMerchant.carrierConfig.apiToken = '********';
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
router.put('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const updates = req.body;

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    if (updates.platform) {
      merchant.platform = updates.platform;
    }

    // Apply platformConfig updates
    if (updates.platformConfig) {
      merchant.platformConfig = merchant.platformConfig || {};
      if (updates.platformConfig.shopifyDomain) {
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
      if (updates.carrierConfig.provider) {
        merchant.carrierConfig.provider = updates.carrierConfig.provider;
      }
      
      const carrierToken = updates.carrierConfig.apiToken;
      if (carrierToken && carrierToken !== '********') {
        merchant.carrierConfig.apiToken = encryptionService.encrypt(carrierToken);
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
      if (updates.paymentConfig.provider) {
        merchant.paymentConfig.provider = updates.paymentConfig.provider;
      }
      
      const payId = updates.paymentConfig.keyId;
      if (payId && payId !== '********') {
        merchant.paymentConfig.keyId = encryptionService.encrypt(payId);
      }

      const paySecret = updates.paymentConfig.keySecret;
      if (paySecret && paySecret !== '********') {
        merchant.paymentConfig.keySecret = encryptionService.encrypt(paySecret);
      }
    }

    // Apply general settings updates
    if (updates.settings) {
      if (updates.settings.codConversion) {
        merchant.settings.codConversion = {
          ...merchant.settings.codConversion,
          ...updates.settings.codConversion,
        };
      }
      if (updates.settings.ndrRescue) {
        merchant.settings.ndrRescue = {
          ...merchant.settings.ndrRescue,
          ...updates.settings.ndrRescue,
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
