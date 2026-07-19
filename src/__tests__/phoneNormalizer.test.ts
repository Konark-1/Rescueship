import { normalizeIndianPhone, isValidIndianPhone } from '../../src/utils/phoneNormalizer';

describe('Phone Normalizer Utils', () => {
  describe('normalizeIndianPhone', () => {
    it('should normalize 10 digit numbers', () => {
      expect(normalizeIndianPhone('9876543210')).toBe('919876543210');
    });

    it('should normalize 11 digit numbers starting with 0', () => {
      expect(normalizeIndianPhone('09876543210')).toBe('919876543210');
    });

    it('should handle numbers with country code', () => {
      expect(normalizeIndianPhone('+919876543210')).toBe('919876543210');
      expect(normalizeIndianPhone('919876543210')).toBe('919876543210');
    });

    it('should handle numbers with spaces and dashes', () => {
      expect(normalizeIndianPhone('+91-9876543210')).toBe('919876543210');
      expect(normalizeIndianPhone('+91 98765 43210')).toBe('919876543210');
    });
  });

  describe('isValidIndianPhone', () => {
    it('should return true for valid Indian mobile numbers', () => {
      expect(isValidIndianPhone('9876543210')).toBe(true);
      expect(isValidIndianPhone('+91-9876543210')).toBe(true);
      expect(isValidIndianPhone('09876543210')).toBe(true);
      expect(isValidIndianPhone('916123456789')).toBe(true);
    });

    it('should return false for invalid Indian mobile numbers', () => {
      expect(isValidIndianPhone('1234567890')).toBe(false); // starts with 1
      expect(isValidIndianPhone('915123456789')).toBe(false); // starts with 5
      expect(isValidIndianPhone('987654321')).toBe(false); // too short
      expect(isValidIndianPhone('98765432101')).toBe(false); // too long
    });
  });
});
