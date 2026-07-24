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
    // Encrypt with old key manually using aes-256-gcm format iv:authTag:ciphertext
    const crypto = require('crypto');
    const oldKeyBuf = crypto.createHash('sha256').update(oldKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', oldKeyBuf, iv);
    let encrypted = cipher.update('secret_value', 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const oldCipherText = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    const newCipherText = encryptionService.reEncrypt(oldCipherText, oldKey);
    
    // Decrypt with new key
    const decryptedText = encryptionService.decrypt(newCipherText);
    expect(decryptedText).toBe('secret_value');
  });
});
