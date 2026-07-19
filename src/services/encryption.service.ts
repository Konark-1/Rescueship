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

import CryptoJS from 'crypto-js';
import logger from '../config/logger';

/**
 * Singleton service that wraps CryptoJS AES for encrypting and decrypting
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
   * Encrypts a plaintext string using AES-256.
   *
   * @param plainText - The value to encrypt (e.g. an API key).
   * @returns The Base64-encoded ciphertext string.
   * @throws {Error} If plainText is empty or encryption fails.
   *
   * @example
   *   const encrypted = encryptionService.encrypt('rzp_live_abc123');
   *   // => "U2FsdGVkX1+..."
   */
  public encrypt(plainText: string): string {
    if (!plainText) {
      throw new Error('Cannot encrypt an empty or undefined string.');
    }

    try {
      const cipherText = CryptoJS.AES.encrypt(plainText, this.encryptionKey).toString();
      logger.debug('Successfully encrypted a value', {
        cipherLength: cipherText.length,
      });
      return cipherText;
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Encryption failed — see logs for details.');
    }
  }

  /**
   * Decrypts a ciphertext string that was previously encrypted with `encrypt()`.
   *
   * @param cipherText - The Base64-encoded AES ciphertext.
   * @returns The original plaintext string.
   * @throws {Error} If cipherText is empty, decryption fails, or the key is wrong.
   *
   * @example
   *   const apiKey = encryptionService.decrypt(stored.encryptedApiKey);
   */
  public decrypt(cipherText: string): string {
    if (!cipherText) {
      throw new Error('Cannot decrypt an empty or undefined string.');
    }

    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, this.encryptionKey);
      const plainText = bytes.toString(CryptoJS.enc.Utf8);

      if (!plainText) {
        throw new Error(
          'Decryption produced an empty result — the ciphertext may be corrupted or ' +
            'the ENCRYPTION_KEY may have changed since encryption.'
        );
      }

      logger.debug('Successfully decrypted a value');
      return plainText;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Decryption failed — the key may be wrong or the data corrupted.');
    }
  }

  /**
   * Re-encrypts a value that was encrypted with a previous key.
   * Useful during key rotation.
   *
   * @param cipherText  - Value encrypted with the OLD key.
   * @param oldKey      - The previous encryption key.
   * @returns The value re-encrypted with the CURRENT key.
   */
  public reEncrypt(cipherText: string, oldKey: string): string {
    if (!cipherText || !oldKey) {
      throw new Error('Both cipherText and oldKey are required for re-encryption.');
    }

    try {
      // Decrypt with old key
      const bytes = CryptoJS.AES.decrypt(cipherText, oldKey);
      const plainText = bytes.toString(CryptoJS.enc.Utf8);

      if (!plainText) {
        throw new Error('Could not decrypt with the provided old key.');
      }

      // Re-encrypt with current key
      return this.encrypt(plainText);
    } catch (error) {
      logger.error('Re-encryption failed', { error });
      throw new Error('Re-encryption failed — check that the old key is correct.');
    }
  }
}

/** Pre-built singleton — import this for convenience. */
export const encryptionService = EncryptionService.getInstance();
