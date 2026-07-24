/**
 * @fileoverview AES-256 Encryption Service for RescueShip
 *
 * Provides symmetric encryption/decryption for sensitive merchant data such as
 * API keys, access tokens, and webhook secrets. Uses CryptoJS AES under the hood
 * with the ENCRYPTION_KEY environment variable as the passphrase.
 *
 * @usage
 *   import { encryptionService } from '@services/encryption.service';
 *   const cipher = encryptionService.encrypt(apiKey);
 *   const plain  = encryptionService.decrypt(cipher);
 *
 * @security
 *   - ENCRYPTION_KEY must be a strong, random 32+ character string.
 *   - NEVER log the encryption key or decrypted values.
 *   - Rotate keys via re-encrypting all stored secrets when compromised.
 */

import crypto from 'crypto';
import logger from '../config/logger';

/**
 * Singleton service that wraps Node native crypto AES-256-GCM for encrypting and decrypting
 * merchant API keys and other sensitive strings.
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private readonly encryptionKey: string;

  /**
   * Private constructor — use `EncryptionService.getInstance()` or the
   * exported `encryptionService` singleton instead.
   */
  private constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 16) {
      throw new Error(
        'ENCRYPTION_KEY env variable is missing or too short (min 16 chars). ' +
          'Set a strong, random key in your .env file.'
      );
    }
    this.encryptionKey = key;
  }

  /**
   * Returns the singleton instance, creating it on first call.
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Derives a deterministic 32-byte key buffer from the given key string using SHA-256.
   */
  private getDerivedKey(keyStr: string): Buffer {
    return crypto.createHash('sha256').update(keyStr).digest();
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   *
   * @param plainText - The value to encrypt (e.g. an API key).
   * @returns Formatted ciphertext string: `iv:authTag:ciphertext` (hex encoded).
   * @throws {Error} If plainText is empty or encryption fails.
   */
  public encrypt(plainText: string): string {
    if (!plainText) {
      throw new Error('Cannot encrypt an empty or undefined string.');
    }

    try {
      const keyBuffer = this.getDerivedKey(this.encryptionKey);
      const iv = crypto.randomBytes(12); // 12-byte (96-bit) IV
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag(); // 16-byte (128-bit) Auth Tag

      const output = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      logger.debug('Successfully encrypted a value', {
        cipherLength: output.length,
      });
      return output;
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Encryption failed — see logs for details.');
    }
  }

  /**
   * Decrypts a ciphertext string formatted as `iv:authTag:ciphertext`.
   *
   * @param cipherText - The formatted AES-256-GCM ciphertext.
   * @returns The original plaintext string.
   * @throws {Error} If cipherText is empty, decryption fails, or authentication tag fails verification.
   */
  public decrypt(cipherText: string): string {
    if (!cipherText) {
      throw new Error('Cannot decrypt an empty or undefined string.');
    }

    try {
      const plainText = this.decryptWithKey(cipherText, this.encryptionKey);
      if (!plainText) {
        throw new Error(
          'Decryption produced an empty result — the ciphertext may be corrupted or ' +
            'the ENCRYPTION_KEY may have changed since encryption.'
        );
      }

      logger.debug('Successfully decrypted a value');
      return plainText;
    } catch (error: any) {
      logger.error('Decryption failed', { error: error.message || error });
      throw new Error('Decryption failed — the key may be wrong or the data corrupted.');
    }
  }

  /**
   * Helper to decrypt ciphertext formatted as `iv:authTag:ciphertext` using a specified key string.
   */
  private decryptWithKey(cipherText: string, keyStr: string): string {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== 12) {
      throw new Error('Invalid IV length. Expected 12 bytes.');
    }
    if (authTag.length !== 16) {
      throw new Error('Invalid auth tag length. Expected 16 bytes.');
    }

    const keyBuffer = this.getDerivedKey(keyStr);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Re-encrypts a value that was encrypted with a previous key.
   * Useful during key rotation.
   *
   * @param cipherText  - Value encrypted with the OLD key (`iv:authTag:ciphertext`).
   * @param oldKey      - The previous encryption key.
   * @returns The value re-encrypted with the CURRENT key.
   */
  public reEncrypt(cipherText: string, oldKey: string): string {
    if (!cipherText || !oldKey) {
      throw new Error('Both cipherText and oldKey are required for re-encryption.');
    }

    try {
      const plainText = this.decryptWithKey(cipherText, oldKey);
      if (!plainText) {
        throw new Error('Could not decrypt with the provided old key.');
      }

      return this.encrypt(plainText);
    } catch (error: any) {
      logger.error('Re-encryption failed', { error: error.message || error });
      throw new Error('Re-encryption failed — check that the old key is correct.');
    }
  }
}

/** Pre-built singleton — import this for convenience. */
export const encryptionService = EncryptionService.getInstance();
