process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

/**
 * storefront-sync.test.ts
 *
 * Unit tests for:
 * 1. StorefrontSyncService (Shopify & WooCommerce REST API integrations)
 * 2. Settings API routes (PUT & GET /api/settings/pincode-rules)
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import settingsRouter from '../src/api/settings.api';
import { storefrontSyncService } from '../src/services/storefront-sync.service';
import { Merchant } from '../src/models';
import { config } from '../src/config/env';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Storefront Sync Service & Geo-Risk Settings', () => {
  const merchantId = '507f1f77bcf86cd799439011';
  let app: express.Application;
  let validToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);

    validToken = jwt.sign(
      { merchantId, email: 'merchant@test.com', tokenVersion: 1 },
      config.jwt.secret || 'test-jwt-secret-key-123456789012'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('StorefrontSyncService.applyRestrictions()', () => {
    it('successfully syncs restricted pincodes to Shopify via Admin REST API metafields', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        platform: 'shopify',
        platformConfig: {
          shopifyDomain: 'brand-store.myshopify.com',
          shopifyAccessToken: 'shpat_secret_token_123',
        },
        pincodeRules: [],
        settings: { pincodeRules: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Merchant, 'findById').mockResolvedValue(mockMerchant as any);
      mockedAxios.post.mockResolvedValueOnce({ data: { metafield: { id: 991 } } });

      const result = await storefrontSyncService.applyRestrictions(merchantId, '110001', {
        forcePrepaid: true,
        mandateAdvance: false,
        advanceAmount: 50,
      });

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe('synced');
      expect(result.rule.pincode).toBe('110001');
      expect(result.rule.forcePrepaid).toBe(true);
      expect(result.rule.syncStatus).toBe('synced');

      // Verify Shopify endpoint, headers, and metafield payload
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, body, options] = mockedAxios.post.mock.calls[0];

      expect(url).toBe('https://brand-store.myshopify.com/admin/api/2024-01/metafields.json');
      expect(options?.headers).toHaveProperty('X-Shopify-Access-Token', 'shpat_secret_token_123');
      expect(options?.headers).toHaveProperty('Content-Type', 'application/json');

      expect(body).toEqual({
        metafield: {
          namespace: 'rescueship',
          key: 'restricted_pincodes',
          value: JSON.stringify([
            {
              pincode: '110001',
              forcePrepaid: true,
              mandateAdvance: false,
              advanceAmount: 50,
              syncStatus: 'pending',
            },
          ]),
          type: 'json',
        },
      });

      expect(mockMerchant.save).toHaveBeenCalled();
    });

    it('successfully syncs restricted pincodes to WooCommerce with HTTP Basic Auth', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        platform: 'woocommerce',
        platformConfig: {
          woocommerceUrl: 'https://woo-store.example.com',
          woocommerceKey: 'ck_test_key_123',
          woocommerceSecret: 'cs_test_secret_456',
        },
        pincodeRules: [],
        settings: { pincodeRules: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Merchant, 'findById').mockResolvedValue(mockMerchant as any);
      mockedAxios.put.mockResolvedValueOnce({ data: { success: true } });

      const result = await storefrontSyncService.applyRestrictions(merchantId, '560001', {
        forcePrepaid: false,
        mandateAdvance: true,
        advanceAmount: 50,
      });

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe('synced');
      expect(result.rule.mandateAdvance).toBe(true);

      // Verify WooCommerce endpoint, headers, and options payload
      expect(mockedAxios.put).toHaveBeenCalledTimes(1);
      const [url, body, options] = mockedAxios.put.mock.calls[0];

      expect(url).toBe('https://woo-store.example.com/wp-json/wc/v3/settings/options');
      const expectedBasicAuth = `Basic ${Buffer.from('ck_test_key_123:cs_test_secret_456').toString('base64')}`;
      expect(options?.headers).toHaveProperty('Authorization', expectedBasicAuth);

      expect(body).toEqual({
        id: 'rescueship_restricted_pincodes',
        value: JSON.stringify([
          {
            pincode: '560001',
            forcePrepaid: false,
            mandateAdvance: true,
            advanceAmount: 50,
            syncStatus: 'pending',
          },
        ]),
      });

      expect(mockMerchant.save).toHaveBeenCalled();
    });

    it('gracefully handles storefront API timeout/error and marks rule as pending sync', async () => {
      const mockMerchant: any = {
        _id: merchantId,
        platform: 'shopify',
        platformConfig: {
          shopifyDomain: 'broken-store.myshopify.com',
          shopifyAccessToken: 'shpat_invalid',
        },
        pincodeRules: [],
        settings: { pincodeRules: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Merchant, 'findById').mockResolvedValue(mockMerchant as any);
      mockedAxios.post.mockRejectedValueOnce(new Error('Shopify API Connection Timeout'));

      const result = await storefrontSyncService.applyRestrictions(merchantId, '400001', {
        forcePrepaid: true,
        mandateAdvance: true,
      });

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe('pending');
      expect(result.error).toContain('Shopify API Connection Timeout');
      expect(result.rule.syncStatus).toBe('pending');
      expect(mockMerchant.save).toHaveBeenCalled();
    });
  });

  describe('API Endpoints: /api/settings/pincode-rules', () => {
    beforeEach(() => {
      jest.spyOn(Merchant, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: merchantId,
          tokenVersion: 1,
          pincodeRules: [
            {
              pincode: '110001',
              forcePrepaid: true,
              mandateAdvance: false,
              advanceAmount: 50,
              syncStatus: 'synced',
            },
          ],
        }),
      } as any);
    });

    it('GET /api/settings/pincode-rules requires authentication', async () => {
      const res = await request(app).get('/api/settings/pincode-rules');
      expect(res.status).toBe(401);
    });

    it('GET /api/settings/pincode-rules returns active rules for authenticated merchant', async () => {
      const res = await request(app)
        .get('/api/settings/pincode-rules')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.rules)).toBe(true);
      expect(res.body.rules[0].pincode).toBe('110001');
    });

    it('PUT /api/settings/pincode-rules validates payload', async () => {
      const res = await request(app)
        .put('/api/settings/pincode-rules')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ pincode: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid pincode is required');
    });

    it('PUT /api/settings/pincode-rules updates rule and triggers storefront sync', async () => {
      jest.spyOn(storefrontSyncService, 'applyRestrictions').mockResolvedValueOnce({
        success: true,
        syncStatus: 'synced',
        pincode: '110001',
        rule: {
          pincode: '110001',
          forcePrepaid: true,
          mandateAdvance: false,
          advanceAmount: 50,
          syncStatus: 'synced',
        },
      });

      const res = await request(app)
        .put('/api/settings/pincode-rules')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          pincode: '110001',
          rules: {
            forcePrepaid: true,
            mandateAdvance: false,
            advanceAmount: 50,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pincode).toBe('110001');
      expect(res.body.rules.forcePrepaid).toBe(true);
      expect(res.body.syncStatus).toBe('synced');
    });
  });
});
