process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';
process.env.JWT_SECRET = 'test-jwt-secret-key-1234567890';

import dns from 'dns';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';
import {
  isPrivateOrReservedIp,
  assertPublicHostname,
  isSafeFrontendOrigin,
  verifyStateToken,
} from '../src/utils/security.utils';
import { WooCommerceConnectService } from '../src/services/woocommerce-connect.service';
import connectRouter from '../src/api/connect.api';
import ordersRouter from '../src/api/orders.api';
import { Order } from '../src/models';

jest.mock('../src/models', () => ({
  Merchant: {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        connections: {},
      }),
    }),
    findOne: jest.fn().mockResolvedValue(null),
  },
  Order: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
  },
  AuditLog: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    }),
  },
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.merchant = { merchantId: '507f1f77bcf86cd799439011' };
    next();
  },
}));

jest.mock('../src/services/shopify-oauth.service', () => ({
  shopifyOAuthService: {
    isConfigured: jest.fn().mockReturnValue(true),
    isDemoAvailable: jest.fn().mockReturnValue(false),
    handleCallback: jest.fn().mockImplementation(async (query: any) => {
      if (query.code === 'valid_code') {
        return { shop: 'test.myshopify.com', merchantId: '507f1f77bcf86cd799439011' };
      }
      throw new Error('Invalid code or HMAC');
    }),
  },
}));

describe('Red Team Security Hardening Suite', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890';
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ═════════════════════════════════════════════════════════════════
  // 1. IP and Subnet Classification (SSRF Defense)
  // ═════════════════════════════════════════════════════════════════
  describe('SSRF Guard: isPrivateOrReservedIp', () => {
    test('Correctly identifies IPv4 loopback, private, link-local, and reserved ranges', () => {
      // Loopback
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('127.255.255.254')).toBe(true);
      // Link-Local / AWS IMDS
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      // RFC 1918 Private
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('10.255.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.0.254')).toBe(true);
      // CGNAT / Current / Multicast / Broadcast
      expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
      expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('224.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('255.255.255.255')).toBe(true);
    });

    test('Allows public IPv4 addresses', () => {
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
      expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false);
    });

    test('Correctly identifies IPv6 loopback, unique local, link-local, and mapped addresses', () => {
      expect(isPrivateOrReservedIp('::1')).toBe(true);
      expect(isPrivateOrReservedIp('::')).toBe(true);
      expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIp('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:10.0.0.1')).toBe(true);
    });

    test('Allows public IPv6 addresses and maps public IPv4-in-IPv6', () => {
      expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false);
      expect(isPrivateOrReservedIp('2001:4860:4860::8888')).toBe(false);
      expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false);
    });

    test('Fails closed on empty, null, or malformed IP strings', () => {
      expect(isPrivateOrReservedIp('')).toBe(true);
      expect(isPrivateOrReservedIp(null as any)).toBe(true);
      expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
      expect(isPrivateOrReservedIp('999.999.999.999')).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 2. DNS Hostname SSRF Validation
  // ═════════════════════════════════════════════════════════════════
  describe('SSRF Guard: assertPublicHostname', () => {
    test('Rejects localhost and literal private IP addresses directly', async () => {
      await expect(assertPublicHostname('localhost')).rejects.toThrow('SSRF Blocked');
      await expect(assertPublicHostname('127.0.0.1')).rejects.toThrow('SSRF Blocked');
      await expect(assertPublicHostname('169.254.169.254')).rejects.toThrow('SSRF Blocked');
      await expect(assertPublicHostname('10.0.0.5')).rejects.toThrow('SSRF Blocked');
    });

    test('Rejects hostnames resolving to private IP addresses (DNS rebinding / internal routing)', async () => {
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '127.0.0.1', family: 4 },
      ] as any);

      await expect(assertPublicHostname('evil-internal.attacker.com')).rejects.toThrow(
        'SSRF Blocked: DNS resolved to private/reserved IP 127.0.0.1'
      );
      lookupSpy.mockRestore();
    });

    test('Allows hostnames resolving exclusively to public IPs', async () => {
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ] as any);

      await expect(assertPublicHostname('example-store.com')).resolves.toBeUndefined();
      lookupSpy.mockRestore();
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 3. Frontend Origin & Open Redirect Protection
  // ═════════════════════════════════════════════════════════════════
  describe('Open Redirect Guard: isSafeFrontendOrigin & verifyStateToken', () => {
    test('Allows official Netlify app domains and subdomains', () => {
      expect(isSafeFrontendOrigin('https://rescueship.netlify.app')).toBe(true);
      expect(isSafeFrontendOrigin('https://deploy-preview-42--rescueship.netlify.app')).toBe(true);
      expect(isSafeFrontendOrigin('https://app.rescueship.io')).toBe(true);
    });

    test('Rejects arbitrary attacker-controlled origins', () => {
      expect(isSafeFrontendOrigin('https://attacker-controlled-site.com')).toBe(false);
      expect(isSafeFrontendOrigin('https://evil-rescueship.com')).toBe(false);
      expect(isSafeFrontendOrigin('https://fake-login-form.org')).toBe(false);
      expect(isSafeFrontendOrigin('javascript:alert(1)')).toBe(false);
      expect(isSafeFrontendOrigin('')).toBe(false);
      expect(isSafeFrontendOrigin(undefined)).toBe(false);
    });

    test('verifyStateToken validates genuine JWT and rejects tampered tokens', () => {
      const validPayload = { merchantId: 'm_123', returnOrigin: 'https://rescueship.netlify.app' };
      const validToken = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '10m' });

      const verified = verifyStateToken(validToken);
      expect(verified).toMatchObject(validPayload);

      // Tampered signature
      const tamperedToken = validToken.slice(0, -5) + 'abcde';
      expect(verifyStateToken(tamperedToken)).toBeNull();

      // Forged with wrong secret
      const forgedToken = jwt.sign(validPayload, 'wrong-secret', { expiresIn: '10m' });
      expect(verifyStateToken(forgedToken)).toBeNull();

      // Malformed string
      expect(verifyStateToken('not-a-jwt')).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 4. End-to-End Shopify OAuth Callback Open Redirect Test
  // ═════════════════════════════════════════════════════════════════
  describe('Vulnerability Fix 1: Shopify OAuth Open Redirect Remediation', () => {
    const app = express();
    app.use('/api/connect', connectRouter);

    test('Crafted state parameter with malicious returnOrigin is rejected and defaults to safe origin', async () => {
      // Attacker creates a token without proper secret or with an attacker returnOrigin
      const evilPayload = { returnOrigin: 'https://attacker-controlled-site.com' };
      // Even if attacker tries to sign with a dummy secret or passes unverified base64
      const attackerToken = jwt.sign(evilPayload, 'attacker-secret');

      const res = await request(app)
        .get('/api/connect/shopify/callback')
        .query({ state: attackerToken, code: 'invalid_code' });

      // Must redirect to safe origin (/onboarding?error=shopify), NEVER to attacker site
      expect(res.status).toBe(302);
      expect(res.header.location).not.toContain('attacker-controlled-site.com');
      expect(res.header.location).toContain('/onboarding?error=shopify');
    });

    test('Valid signed state token with safe origin redirects to legitimate frontend', async () => {
      const safePayload = {
        returnOrigin: 'https://rescueship.netlify.app',
        merchantId: '507f1f77bcf86cd799439011',
      };
      const legitimateToken = jwt.sign(safePayload, JWT_SECRET, { expiresIn: '10m' });

      const res = await request(app)
        .get('/api/connect/shopify/callback')
        .query({ state: legitimateToken, code: 'valid_code', shop: 'test.myshopify.com' });

      expect(res.status).toBe(302);
      expect(res.header.location).toBe('https://rescueship.netlify.app/onboarding?connected=shopify');
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 5. End-to-End WooCommerce SSRF Defense Test
  // ═════════════════════════════════════════════════════════════════
  describe('Vulnerability Fix 2: WooCommerce Blind SSRF Remediation', () => {
    const service = new WooCommerceConnectService();

    test('Rejects store connection to AWS metadata IP 169.254.169.254', async () => {
      await expect(
        service.connect('m_123', {
          url: 'https://169.254.169.254',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        })
      ).rejects.toThrow('SSRF Blocked: IP address 169.254.169.254 is private/reserved');
    });

    test('Rejects store connection to localhost / 127.0.0.1', async () => {
      await expect(
        service.connect('m_123', {
          url: 'https://127.0.0.1:8443',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        })
      ).rejects.toThrow('SSRF Blocked');
    });

    test('Rejects store connection to internal private subnets (10.x, 192.168.x)', async () => {
      await expect(
        service.connect('m_123', {
          url: 'https://192.168.1.50',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        })
      ).rejects.toThrow('SSRF Blocked');
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 6. Orders API Query Parameter Hardening (NoSQL Injection Defense)
  // ═════════════════════════════════════════════════════════════════
  describe('Hardening Roadmap 3: Orders API Query Sanitization', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', ordersRouter);

    test('Ignores unwhitelisted or operator-based statuses', async () => {
      (Order.find as jest.Mock).mockClear();

      await request(app)
        .get('/api/orders')
        .query({ status: 'INVALID_STATUS_OR_INJECTION' });

      const findQuery = (Order.find as jest.Mock).mock.calls[0][0];
      // status must NOT be set if it's not in the whitelist
      expect(findQuery.status).toBeUndefined();
    });

    test('Applies valid whitelisted status', async () => {
      (Order.find as jest.Mock).mockClear();

      await request(app)
        .get('/api/orders')
        .query({ status: 'delivered' });

      const findQuery = (Order.find as jest.Mock).mock.calls[0][0];
      expect(findQuery.status).toBe('delivered');
    });

    test('Applies valid carrier from whitelist and rejects unknown carriers', async () => {
      (Order.find as jest.Mock).mockClear();

      await request(app)
        .get('/api/orders')
        .query({ carrier: 'unknown_carrier' });

      let findQuery = (Order.find as jest.Mock).mock.calls[0][0];
      expect(findQuery.carrier).toBeUndefined();

      (Order.find as jest.Mock).mockClear();
      await request(app)
        .get('/api/orders')
        .query({ carrier: 'delhivery' });

      findQuery = (Order.find as jest.Mock).mock.calls[0][0];
      expect(findQuery.carrier).toBe('delhivery');
    });
  });
});
