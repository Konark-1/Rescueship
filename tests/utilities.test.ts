import { makeJobId } from '../src/utils/job-id';
import { maskPhone, logger } from '../src/utils/logger';

describe('Utility Functions Hardening', () => {
  describe('makeJobId (BullMQ Job Identifier Generator)', () => {
    it('generates deterministic and formatted custom job IDs', () => {
      const id1 = makeJobId('cod', 'merchant123', 'order_456');
      const id2 = makeJobId('cod', 'merchant123', 'order_456');

      expect(id1).toBe('cod__merchant123__order_456');
      expect(id1).toBe(id2);
    });

    it('sanitizes illegal colon (:) characters that break BullMQ internal keys', () => {
      // BullMQ throws "Custom Id cannot contain :" if a colon is in the custom id
      const id = makeJobId('escalation', 'order:123:abc', 'attempt:1');
      expect(id).not.toContain(':');
      expect(id).toBe('escalation__order_123_abc__attempt_1');
    });

    it('sanitizes spaces, slashes, and special characters', () => {
      const id = makeJobId('sync', 'store name/1', 'action@now#yes');
      expect(id).toBe('sync__store_name_1__action_now_yes');
    });

    it('filters out null, undefined, and empty string arguments safely', () => {
      const id = makeJobId('pay', null, 'razorpay', undefined, '', 'plink_789');
      expect(id).toBe('pay__razorpay__plink_789');
    });

    it('handles numerical parts', () => {
      const id = makeJobId('order', 1001, 'step', 2);
      expect(id).toBe('order__1001__step__2');
    });
  });

  describe('Logger PII Masking & Secret Redaction', () => {
    it('masks Indian and international phone numbers to last 4 digits', () => {
      expect(maskPhone('+919876543210')).toBe('***3210');
      expect(maskPhone('9876543210')).toBe('***3210');
      expect(maskPhone('+1 (555) 234-5678')).toBe('***5678');
      expect(maskPhone('123')).toBe('***');
      expect(maskPhone(null)).toBe('');
      expect(maskPhone(undefined)).toBe('');
    });

    it('does not throw when logging metadata with circular references or errors', () => {
      const circular: any = { name: 'circular_test' };
      circular.self = circular;

      expect(() => {
        logger.info('Testing circular log metadata', {
          data: circular,
          error: new Error('Simulated handled error'),
        });
      }).not.toThrow();
    });

    it('does not throw when logging secrets and sensitive keys', () => {
      expect(() => {
        logger.info('Testing secret redaction', {
          password: 'super_secret_password',
          apiKey: 'key_1234567890',
          client_secret: 'sec_abcdef',
          phone: '+919988776655',
          tokenPresent: true, // safe key
        });
      }).not.toThrow();
    });
  });
});
