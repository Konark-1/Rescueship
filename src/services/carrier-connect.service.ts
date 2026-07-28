/**
 * carrier-connect.service.ts
 * ─────────────────────────────────────────────────────────────
 * Validate-then-store. We hit a cheap read endpoint with the supplied
 * creds BEFORE encrypting+saving, so a merchant can never store dead
 * keys (self-serve safety). Reuses provider base URLs; never logs creds.
 */
import axios from 'axios';
import { encryptionService } from './encryption.service';
import { Merchant } from '../models';
import { logger } from '../utils/logger';

export type Provider = 'shiprocket' | 'delhivery' | 'clickpost';
export interface CarrierCreds { provider: Provider; email?: string; password?: string; apiToken?: string; apiKey?: string; }

async function validateShiprocket(c: CarrierCreds) {
  const { data } = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', { email: c.email, password: c.password });
  return data.token as string; // throws on 401
}
async function validateDelhivery(c: CarrierCreds) {
  await axios.get('https://track.delhivery.com/api/v1/packages/json', { headers: { 'Content-Type': 'application/json', Authorization: `Token ${c.apiToken}` }, params: { id: '0' } }); // 401/403 throws
}
async function validateClickpost(c: CarrierCreds) {
  await axios.get('https://api.clickpost.in/api/v3/carriers/', { params: { key: c.apiKey } }); // 401 throws
}

export class CarrierConnectService {
  async validateAndSave(merchantId: string, creds: CarrierCreds) {
    // 1. validate (throws → we never store)
    let shiprocketToken: string | undefined;
    if (creds.provider === 'shiprocket') shiprocketToken = await validateShiprocket(creds);
    else if (creds.provider === 'delhivery') await validateDelhivery(creds);
    else if (creds.provider === 'clickpost') await validateClickpost(creds);
    else throw new Error('Unsupported carrier');

    // 2. store encrypted (engine reads these unchanged)
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    const store: any = { provider: creds.provider };
    if (creds.apiToken) store.apiToken = encryptionService.encrypt(creds.apiToken);
    if (creds.apiKey) store.apiKey = encryptionService.encrypt(creds.apiKey);
    if (creds.email) store.email = encryptionService.encrypt(creds.email);
    if (creds.password) store.password = encryptionService.encrypt(creds.password);
    if (shiprocketToken) store.shiprocketToken = encryptionService.encrypt(shiprocketToken);
    (merchant as any).carrierConfig = store;
    (merchant as any).connections = { ...((merchant as any).connections || {}), carrier: { status: 'connected', connectedAt: new Date(), provider: creds.provider, lastError: null } };
    await merchant.save();
    logger.info('Carrier connected', { merchantId, provider: creds.provider });
    return { status: 'connected', provider: creds.provider };
  }
}
export const carrierConnectService = new CarrierConnectService();
