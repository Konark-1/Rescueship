/**
 * payment-connect.service.ts — validate-then-store for Razorpay / Cashfree.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

export class PaymentConnectService {
  async validateAndSave(merchantId: string, gateway: 'razorpay' | 'cashfree', keyId: string, keySecret: string) {
    if (gateway === 'razorpay') {
      await axios.get('https://api.razorpay.com/v1/plans?count=1', { auth: { username: keyId, password: keySecret } }); // 401 throws
    } else {
      await axios.get('https://api.cashfree.com/pg/orders?limit=1', { headers: { 'x-client-id': keyId, 'x-client-secret': keySecret, 'x-api-version': '2023-08-01' } });
    }
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    (merchant as any).paymentConfig = {
      gateway,
      keyId: encryptionService.encrypt(keyId),
      keySecret: encryptionService.encrypt(keySecret),
    };
    (merchant as any).connections = { ...((merchant as any).connections || {}), payment: { status: 'connected', connectedAt: new Date(), gateway, lastError: null } };
    await merchant.save();
    logger.info('Payment gateway connected', { merchantId, gateway });
    return { status: 'connected', gateway };
  }
}
export const paymentConnectService = new PaymentConnectService();
