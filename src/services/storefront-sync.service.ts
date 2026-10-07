import axios from 'axios';
import { Merchant, IPincodeRule } from '../models';
import { encryptionService } from './encryption.service';
import logger from '../config/logger';

export interface ApplyRestrictionsParams {
  forcePrepaid?: boolean;
  mandateAdvance?: boolean;
  advanceAmount?: number;
}

export interface StorefrontSyncResult {
  success: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  pincode: string;
  rule: IPincodeRule;
  error?: string;
}

export class StorefrontSyncService {
  private static instance: StorefrontSyncService;

  public static getInstance(): StorefrontSyncService {
    if (!StorefrontSyncService.instance) {
      StorefrontSyncService.instance = new StorefrontSyncService();
    }
    return StorefrontSyncService.instance;
  }

  /**
   * Safely decrypt an encrypted string, or return raw value if unencrypted.
   */
  private decryptSafely(val?: string): string {
    if (!val) return '';
    // Formatted ciphertext has exactly 3 colon-separated segments: iv:authTag:ciphertext
    if (val.split(':').length === 3) {
      try {
        return encryptionService.decrypt(val);
      } catch {
        return val;
      }
    }
    return val;
  }

  /**
   * Updates a merchant's pincode rule and propagates the active restrictions to Shopify or WooCommerce.
   */
  public async applyRestrictions(
    merchantId: string,
    pincode: string,
    rules: ApplyRestrictionsParams
  ): Promise<StorefrontSyncResult> {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantId}`);
    }

    const cleanPincode = String(pincode).trim();
    const forcePrepaid = Boolean(rules.forcePrepaid);
    const mandateAdvance = Boolean(rules.mandateAdvance);
    const advanceAmount = Number(rules.advanceAmount ?? 50);

    if (!merchant.pincodeRules) {
      merchant.pincodeRules = [];
    }

    let existingRuleIndex = merchant.pincodeRules.findIndex(
      (r) => r.pincode === cleanPincode
    );

    const updatedRule: IPincodeRule = {
      pincode: cleanPincode,
      forcePrepaid,
      mandateAdvance,
      advanceAmount,
      syncStatus: 'pending',
      lastSyncedAt: undefined,
      syncError: undefined,
    };

    if (existingRuleIndex >= 0) {
      merchant.pincodeRules[existingRuleIndex] = {
        ...merchant.pincodeRules[existingRuleIndex],
        ...updatedRule,
      };
    } else {
      merchant.pincodeRules.push(updatedRule);
      existingRuleIndex = merchant.pincodeRules.length - 1;
    }

    // Mirror to merchant.settings.pincodeRules
    if (!merchant.settings) {
      (merchant as any).settings = {} as any;
    }
    merchant.settings.pincodeRules = [...merchant.pincodeRules];

    // Compute active restrictions for the storefront
    const activeRestrictions = merchant.pincodeRules.filter(
      (r) => r.forcePrepaid || r.mandateAdvance
    );

    let syncStatus: 'synced' | 'pending' | 'failed' = 'pending';
    let syncError: string | undefined = undefined;

    // Resolve credentials
    const shopifyDomain =
      merchant.platformConfig?.shopifyDomain ||
      merchant.shopify?.shopDomain ||
      (merchant as any).shop_domain;

    const rawShopifyToken =
      merchant.platformConfig?.shopifyAccessToken ||
      merchant.shopify?.accessToken ||
      (merchant as any).shopify_access_token;

    const wcUrl =
      merchant.platformConfig?.woocommerceUrl ||
      merchant.connections?.woocommerce?.url ||
      (merchant as any).woocommerce_url;

    const rawWcKey =
      merchant.platformConfig?.woocommerceKey ||
      (merchant as any).wc_consumer_key;

    const rawWcSecret =
      merchant.platformConfig?.woocommerceSecret ||
      (merchant as any).wc_consumer_secret;

    try {
      if (shopifyDomain && rawShopifyToken) {
        const shopifyToken = this.decryptSafely(rawShopifyToken);
        const domain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

        // Use Shopify Admin REST API to update Shop Metafield
        await axios.post(
          `https://${domain}/admin/api/2024-01/metafields.json`,
          {
            metafield: {
              namespace: 'rescueship',
              key: 'restricted_pincodes',
              value: JSON.stringify(activeRestrictions),
              type: 'json',
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        syncStatus = 'synced';
        logger.info('Successfully synced restricted pincodes to Shopify storefront', {
          merchantId,
          pincode: cleanPincode,
          domain,
          restrictionsCount: activeRestrictions.length,
        });
      } else if (wcUrl && rawWcKey && rawWcSecret) {
        const key = this.decryptSafely(rawWcKey);
        const secret = this.decryptSafely(rawWcSecret);
        const baseUrl = wcUrl.replace(/\/+$/, '');
        const authHeader = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;

        // Use WooCommerce REST API to update restricted pincodes
        await axios.put(
          `${baseUrl}/wp-json/wc/v3/settings/options`,
          {
            id: 'rescueship_restricted_pincodes',
            value: JSON.stringify(activeRestrictions),
          },
          {
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        syncStatus = 'synced';
        logger.info('Successfully synced restricted pincodes to WooCommerce storefront', {
          merchantId,
          pincode: cleanPincode,
          baseUrl,
          restrictionsCount: activeRestrictions.length,
        });
      } else {
        syncStatus = 'pending';
        syncError = 'Storefront not connected yet';
        logger.warn('Storefront credentials not found; marked pincode rule as pending sync', {
          merchantId,
          pincode: cleanPincode,
          platform: merchant.platform,
        });
      }
    } catch (err: any) {
      syncStatus = 'pending';
      syncError =
        err?.response?.data?.errors ||
        err?.response?.data?.message ||
        err.message ||
        'Storefront sync error';
      logger.error('Failed to sync restricted pincodes to storefront', {
        merchantId,
        pincode: cleanPincode,
        platform: merchant.platform,
        error: syncError,
      });
    }

    // Save final status on rule
    merchant.pincodeRules[existingRuleIndex].syncStatus = syncStatus;
    merchant.pincodeRules[existingRuleIndex].lastSyncedAt =
      syncStatus === 'synced' ? new Date() : undefined;
    merchant.pincodeRules[existingRuleIndex].syncError = syncError;

    if (merchant.settings?.pincodeRules) {
      merchant.settings.pincodeRules[existingRuleIndex].syncStatus = syncStatus;
      merchant.settings.pincodeRules[existingRuleIndex].lastSyncedAt =
        syncStatus === 'synced' ? new Date() : undefined;
      merchant.settings.pincodeRules[existingRuleIndex].syncError = syncError;
    }

    await merchant.save();

    return {
      success: true,
      syncStatus,
      pincode: cleanPincode,
      rule: merchant.pincodeRules[existingRuleIndex],
      error: syncError,
    };
  }
}

export const storefrontSyncService = StorefrontSyncService.getInstance();
