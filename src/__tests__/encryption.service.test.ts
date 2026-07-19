process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';

import { encryptionService, EncryptionService } from '../../src/services/encryption.service';

describe('EncryptionService', () => {
  it('should encrypt and decrypt correctly', () => {
    const plainText = 'test_secret_value';
    const cipherText = encryptionService.encrypt(plainText);
    expect(cipherText).not.toBe(plainText);
    
    const decryptedText = encryptionService.decrypt(cipherText);
    expect(decryptedText).toBe(plainText);
  });

  it('should throw error when encrypting empty string', () => {
    expect(() => encryptionService.encrypt('')).toThrow('Cannot encrypt an empty or undefined string.');
  });

  it('should throw error when decrypting empty string', () => {
    expect(() => encryptionService.decrypt('')).toThrow('Cannot decrypt an empty or undefined string.');
  });

  it('should reEncrypt correctly', () => {
    const oldKey = 'this_is_the_old_encryption_key_32_chars_long';
    // Encrypt with old key manually
    const CryptoJS = require('crypto-js');
    const oldCipherText = CryptoJS.AES.encrypt('secret_value', oldKey).toString();

    const newCipherText = encryptionService.reEncrypt(oldCipherText, oldKey);
    
    // Decrypt with new key
    const decryptedText = encryptionService.decrypt(newCipherText);
    expect(decryptedText).toBe('secret_value');
  });
});
