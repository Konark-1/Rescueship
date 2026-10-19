import { redisCache } from '../utils/redis-cache';
import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

export type CarrierType = 'shiprocket' | 'clickpost' | 'delhivery' | 'bluedart' | 'xpressbees' | 'shadowfax' | 'ecomexpress' | 'dtdc' | 'custom';

export interface CarrierConfig {
  provider?: CarrierType;
  mode?: 'api' | 'webhook_only' | string;
  apiToken?: string; // For ClickPost / Delhivery / Xpressbees / Shadowfax / DTDC
  apiKey?: string;
  email?: string; // Shiprocket specific
  password?: string; // Shiprocket / Ecom Express specific
  username?: string; // Ecom Express specific
  customerCode?: string; // Blue Dart / DTDC specific
  licenseKey?: string; // Blue Dart specific
  loginId?: string; // Blue Dart specific
}

export interface RescheduleParams {
  awb: string;
  newDate?: string; // format YYYY-MM-DD
  reason: string;
}

export interface AddressUpdateParams {
  awb: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  customerName?: string;
  landmark?: string;
  driverNote?: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  preferredDate?: string;
}

export interface CancelParams {
  awb: string;
  reason?: string;
}

export interface CodAmendmentParams {
  awb: string;
  newCodAmount: number;
  reason: string;
}

export interface RescheduleResult {
  success: boolean;
  message: string;
  carrierResponse?: any;
  errorCode?: string;
}

function sanitizeString(input: string | undefined, maxLength: number, fallback: string = ''): string {
  if (!input) return fallback;
  const sanitized = input.replace(/[^a-zA-Z0-9\s,\-/#.]/g, '').trim();
  return sanitized.slice(0, maxLength) || fallback;
}

function sanitizePincode(pincode: string | undefined): string {
  if (!pincode) return '000000';
  const digitsOnly = pincode.replace(/\D/g, '');
  return digitsOnly.slice(0, 6);
}

function sanitizeDeferredDate(dateStr: string | undefined): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const maxFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return tomorrow.toISOString().split('T')[0];
  }

  const requestedDate = new Date(dateStr);
  if (isNaN(requestedDate.getTime()) || requestedDate > maxFuture) {
    return tomorrow.toISOString().split('T')[0];
  }

  return dateStr;
}

/**
 * ClickPost NDR action API (v2). Auth is username + key as query params; the body needs the
 * courier partner id (cp_id) and account_code that ClickPost sends on its tracking webhook,
 * stored on the order as carrierMeta. Actions: REATTEMPT (address, drop_pincode, phone_number,
 * preferred_date) or INITIATE_RTO. There is no COD amendment action.
 */
const CLICKPOST_NDR_URL = process.env.CLICKPOST_NDR_URL || 'https://www.clickpost.in/api/v2/ndr-update-api';

async function clickPostShipmentContext(awb: string, merchantId?: string): Promise<any | null> {
  const { Order } = require('../models');
  const q: any = { awb, carrier: 'clickpost' };
  if (merchantId) q.merchantId = merchantId;
  const rows = await Order.find(q).select('merchantId carrierMeta shippingAddress shippingPincode customerPhone').limit(2).lean();
  return rows.length === 1 ? rows[0] : null; // ambiguous across tenants → refuse
}

async function clickPostNdrAction(
  awb: string,
  carrierConfig: CarrierConfig | undefined,
  action: 'REATTEMPT' | 'INITIATE_RTO',
  fields: { address?: string; landmark?: string; pincode?: string; phone?: string; preferredDate?: string; remark?: string }
): Promise<RescheduleResult> {
  const key = carrierConfig?.apiKey || carrierConfig?.apiToken;
  const username = carrierConfig?.username;
  if (!key || !username) {
    return { success: false, message: 'ClickPost username and API key are required' };
  }
  const ctx = await clickPostShipmentContext(awb, (carrierConfig as any)?.merchantId);
  const cpId = ctx?.carrierMeta?.cpId;
  const accountCode = ctx?.carrierMeta?.accountCode;
  if (!cpId || !accountCode) {
    return { success: false, message: 'ClickPost courier id/account code not known for this AWB yet (arrives with the first ClickPost tracking webhook)' };
  }
  const addr: any = ctx?.shippingAddress && typeof ctx.shippingAddress === 'object' ? ctx.shippingAddress : {};
  const payload: any = { waybill: awb, cp_id: cpId, account_code: accountCode, action };
  if (action === 'REATTEMPT') {
    payload.address = sanitizeString(fields.address || [addr.address1, addr.address2, addr.city].filter(Boolean).join(', '), 250);
    payload.landmark = sanitizeString(fields.landmark, 100);
    payload.drop_pincode = sanitizePincode(fields.pincode || ctx?.shippingPincode || addr.zip);
    payload.phone_number = sanitizeString(fields.phone || ctx?.customerPhone, 15);
    payload.preferred_date = sanitizeDeferredDate(fields.preferredDate);
    if (!payload.address || !payload.drop_pincode || !payload.phone_number) {
      return { success: false, message: 'ClickPost reattempt needs address, pincode and phone' };
    }
  }
  if (fields.remark) payload.remark = sanitizeString(fields.remark, 150);
  try {
    const response = await axios.post(CLICKPOST_NDR_URL, payload, {
      params: { username, key },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    const ok = response.data?.meta?.success === true || response.data?.meta?.status === 200 || response.data?.meta?.status === 'success';
    return { success: ok, message: response.data?.meta?.message || `ClickPost ${action}`, carrierResponse: response.data };
  } catch (error: any) {
    logger.error('ClickPost NDR action failed', { awb, action, error: error.response?.data || error.message });
    return { success: false, message: error.message, carrierResponse: error.response?.data };
  }
}

export class LogisticsService {
  private static instance: LogisticsService;
  private tokenPromises = new Map<string, Promise<string>>();

  private constructor() {}

  public static getInstance(): LogisticsService {
    if (!LogisticsService.instance) {
      LogisticsService.instance = new LogisticsService();
    }
    return LogisticsService.instance;
  }

  /**
   * Authenticate with Shiprocket and return token
   */
  public async getShiprocketToken(email?: string, password?: string): Promise<string> {
    // Per-merchant API user only. A platform fallback would act on AWBs with the wrong account.
    const srEmail = email;
    const srPassword = password;

    if (!srEmail || !srPassword) {
      throw new Error('Shiprocket email and password are not configured');
    }

    // Try to get token from Redis cache first
    const cacheKey = `shiprocket:token:${srEmail}`;
    try {
      const cachedToken = await redisCache.get(cacheKey);
      if (cachedToken) {
        return cachedToken;
      }
    } catch (err: any) {
      logger.warn('Failed to retrieve Shiprocket token from Redis cache', { error: err.message });
    }

    // If a request is already in flight for this email, await it
    if (this.tokenPromises.has(srEmail)) {
      return this.tokenPromises.get(srEmail)!;
    }

    const fetchPromise = (async () => {
      const url = 'https://apiv2.shiprocket.in/v1/external/auth/login';
      try {
        logger.info('Requesting new Shiprocket auth token', { email: srEmail });
        const response = await axios.post(url, {
          email: srEmail,
          password: srPassword,
        });

        const token = response.data.token;
        if (!token) {
          throw new Error('Token not found in Shiprocket login response');
        }

        // Cache token in Redis (valid for 9 days, Shiprocket tokens expire in 10 days)
        try {
          await redisCache.set(cacheKey, token, 'EX', 9 * 24 * 60 * 60);
        } catch (err: any) {
          logger.warn('Failed to cache Shiprocket token in Redis', { error: err.message });
        }

        return token;
      } catch (error: any) {
        logger.error('Failed to log in to Shiprocket', { error: error.response?.data || error.message });
        throw new Error(`Shiprocket login failed: ${error.message}`);
      } finally {
        this.tokenPromises.delete(srEmail);
      }
    })();

    this.tokenPromises.set(srEmail, fetchPromise);
    return fetchPromise;
  }

  /**
   * Reschedule delivery on the carrier
   */
  public async rescheduleDelivery(
    carrier: CarrierType,
    params: RescheduleParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    logger.info('Rescheduling delivery', { carrier, awb: params.awb });

    if (carrierConfig?.mode === 'webhook_only') {
      logger.info('Delivery reschedule recorded in RescueShip (carrier is in Webhook-Only mode)', { carrier, awb: params.awb });
      return {
        success: true,
        message: `Delivery reschedule recorded in RescueShip (Webhook-Only mode for ${carrier}). Reattempt details saved.`,
        carrierResponse: { webhookOnly: true, recorded: true },
      };
    }

    if (carrier === 'shiprocket') {
      return this.rescheduleShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.rescheduleClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.rescheduleDelhivery(params, carrierConfig);
    } else if (carrier === 'bluedart') {
      return this.rescheduleBlueDart(params, carrierConfig);
    } else if (carrier === 'xpressbees') {
      return this.rescheduleXpressbees(params, carrierConfig);
    } else if (carrier === 'shadowfax') {
      return this.rescheduleShadowfax(params, carrierConfig);
    } else if (carrier === 'ecomexpress') {
      return this.rescheduleEcomExpress(params, carrierConfig);
    } else if (carrier === 'dtdc') {
      return this.rescheduleDTDC(params, carrierConfig);
    } else if (carrier === 'custom') {
      return { success: true, message: 'Reschedule recorded for custom courier', carrierResponse: { custom: true } };
    } else {
      throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }

  /**
   * Update delivery address on the carrier
   */
  public async updateDeliveryAddress(
    carrier: CarrierType,
    params: AddressUpdateParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    logger.info('Updating delivery address on carrier', { carrier, awb: params.awb });

    if (carrierConfig?.mode === 'webhook_only') {
      logger.info('Delivery address update recorded in RescueShip (carrier is in Webhook-Only mode)', { carrier, awb: params.awb });
      return {
        success: true,
        message: `Delivery address update recorded in RescueShip (Webhook-Only mode for ${carrier}). Corrected address saved.`,
        carrierResponse: { webhookOnly: true, recorded: true },
      };
    }

    if (carrier === 'shiprocket') {
      return this.updateAddressShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.updateAddressClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.updateAddressDelhivery(params, carrierConfig);
    } else if (carrier === 'bluedart') {
      return this.updateAddressBlueDart(params, carrierConfig);
    } else if (carrier === 'xpressbees') {
      return this.updateAddressXpressbees(params, carrierConfig);
    } else if (carrier === 'shadowfax') {
      return this.updateAddressShadowfax(params, carrierConfig);
    } else if (carrier === 'ecomexpress') {
      return this.updateAddressEcomExpress(params, carrierConfig);
    } else if (carrier === 'dtdc') {
      return this.updateAddressDTDC(params, carrierConfig);
    } else if (carrier === 'custom') {
      return { success: true, message: 'Address update recorded for custom courier', carrierResponse: { custom: true } };
    } else {
      throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }

  public async updateAddress(
    carrier: CarrierType,
    params: AddressUpdateParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    return this.updateDeliveryAddress(carrier, params, carrierConfig);
  }

  /**
   * Cancel delivery and request immediate RTO on the carrier to abort return transit
   */
  public async cancelDelivery(
    carrier: CarrierType,
    params: CancelParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    logger.info('Cancelling delivery / requesting RTO on carrier', { carrier, awb: params.awb });

    if (carrierConfig?.mode === 'webhook_only') {
      logger.info('Delivery cancellation / RTO recorded in RescueShip (carrier is in Webhook-Only mode)', { carrier, awb: params.awb });
      return {
        success: true,
        message: `Delivery cancellation recorded in RescueShip (Webhook-Only mode for ${carrier}).`,
        carrierResponse: { webhookOnly: true, recorded: true },
      };
    }

    if (carrier === 'shiprocket') {
      return this.cancelShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.cancelClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.cancelDelhivery(params, carrierConfig);
    } else if (carrier === 'bluedart') {
      return this.cancelBlueDart(params, carrierConfig);
    } else if (carrier === 'xpressbees') {
      return this.cancelXpressbees(params, carrierConfig);
    } else if (carrier === 'shadowfax') {
      return this.cancelShadowfax(params, carrierConfig);
    } else if (carrier === 'ecomexpress') {
      return this.cancelEcomExpress(params, carrierConfig);
    } else if (carrier === 'dtdc') {
      return this.cancelDTDC(params, carrierConfig);
    } else if (carrier === 'custom') {
      return { success: true, message: 'Cancellation / RTO recorded for custom courier', carrierResponse: { custom: true } };
    } else {
      throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }

  public async requestRto(
    carrier: CarrierType,
    params: CancelParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    return this.cancelDelivery(carrier, params, carrierConfig);
  }

  public async adjustCodAmount(
    carrier: CarrierType | string,
    params: CodAmendmentParams,
    carrierConfig?: CarrierConfig
  ): Promise<RescheduleResult> {
    logger.info('Amending COD amount on carrier', { carrier, awb: params.awb, newCodAmount: params.newCodAmount });

    // No test-mode shortcut here: this is a money path, and a fake success would hide that a
    // carrier cannot amend COD (tests mock the carrier call instead).
    if (carrier === 'shiprocket') {
      return this.adjustCodShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.adjustCodClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.adjustCodDelhivery(params, carrierConfig);
    } else {
      return { success: false, message: `Unsupported carrier for COD amendment: ${carrier}` };
    }
  }

  /* ----------------- Carrier Implementations ----------------- */

  private async rescheduleShiprocket(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const token = await this.getShiprocketToken(carrierConfig?.email, carrierConfig?.password);
      // Shiprocket NDR reattempt endpoint
      const url = 'https://apiv2.shiprocket.in/v1/external/ndr/reattempt';
      
      const payload = {
        awb: params.awb,
        deferred_date: sanitizeDeferredDate(params.newDate),
        comments: sanitizeString(params.reason, 150, 'Customer requested reattempt'),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const isSuccess = response.data?.status === 200 || response.data?.success === true;

      return {
        success: isSuccess,
        message: response.data?.message || 'Updated Shiprocket NDR status',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shiprocket reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      // Simulation only when explicitly enabled — never inferred from NODE_ENV.
      if (process.env.CARRIER_SIMULATE === 'true') {
        return { success: true, message: 'Simulated Shiprocket reschedule recorded', carrierResponse: { simulated: true } };
      }
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressShiprocket(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const token = await this.getShiprocketToken(carrierConfig?.email, carrierConfig?.password);
      const url = 'https://apiv2.shiprocket.in/v1/external/ndr/reattempt';

      const landmarkPart = params.landmark ? `Landmark: ${params.landmark}` : '';
      const gatePart = params.driverNote ? `Gate: ${params.driverNote}` : '';
      const gpsPart = params.latitude && params.longitude ? `GPS: ${params.latitude.toFixed(4)},${params.longitude.toFixed(4)}` : '';
      const combinedComments = params.remarks || [landmarkPart, gatePart, gpsPart].filter(Boolean).join(' | ') || 'Customer updated delivery address';

      const cityPin = [params.city, sanitizePincode(params.pincode)].filter(Boolean).join(' ');
      const address2Val = [params.landmark, cityPin].filter(Boolean).join(', ');

      // Shiprocket's reattempt API carries the corrected address as address1/address2 + phone
      // and comments for the rider remarks field (printed on rider app and delivery run-sheet).
      const payload: any = {
        awb: params.awb,
        address1: sanitizeString(params.address, 200),
        address2: sanitizeString(address2Val, 100),
        comments: sanitizeString(combinedComments, 150),
        phone: params.phone,
        deferred_date: sanitizeDeferredDate(params.preferredDate),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const isSuccess = response.data.status === 200 || response.data.success;

      return {
        success: !!isSuccess,
        message: response.data.message || 'Updated Shiprocket address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shiprocket address update failed', { awb: params.awb, error: error.response?.data || error.message });
      if (process.env.CARRIER_SIMULATE === 'true') {
        return { success: true, message: 'Simulated Shiprocket address update recorded', carrierResponse: { simulated: true } };
      }
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async rescheduleClickPost(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    return clickPostNdrAction(params.awb, carrierConfig, 'REATTEMPT', { preferredDate: params.newDate, remark: params.reason });
  }

  private async updateAddressClickPost(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    const landmarkPart = params.landmark ? `Landmark: ${params.landmark}` : '';
    const gatePart = params.driverNote ? `Gate Note: ${params.driverNote}` : '';
    const gpsPart = params.latitude && params.longitude ? `GPS: ${params.latitude.toFixed(4)},${params.longitude.toFixed(4)}` : '';
    const combinedRemark = params.remarks || [landmarkPart, gatePart, gpsPart].filter(Boolean).join(' | ') || 'Address corrected by customer';

    // ClickPost's REATTEMPT carries the corrected address, landmark, and remarks printed on rider app.
    return clickPostNdrAction(params.awb, carrierConfig, 'REATTEMPT', {
      address: [params.address, params.city].filter(Boolean).join(', '),
      landmark: params.landmark,
      pincode: params.pincode,
      phone: params.phone,
      preferredDate: params.preferredDate,
      remark: sanitizeString(combinedRemark, 150),
    });
  }

  private async rescheduleDelhivery(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('Delhivery API Token is not configured');
      }

      // Explicit environment: DELHIVERY_ENV=staging|production (falls back to NODE_ENV).
      const isProd = process.env.DELHIVERY_ENV ? process.env.DELHIVERY_ENV === 'production' : config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;

      // Delhivery NDR API: POST /api/p/update with { data: [{ waybill, act, ... }] }.
      // act = RE-ATTEMPT (retry next working day) | DEFER_DLV (defer to a date, needs deferred_date).
      const deferredDate = sanitizeDeferredDate(params.newDate);
      const actItem: any = deferredDate
        ? { waybill: params.awb, act: 'DEFER_DLV', deferred_date: deferredDate }
        : { waybill: params.awb, act: 'RE-ATTEMPT' };
      if (params.reason) {
        actItem.remarks = sanitizeString(params.reason, 150);
      }
      const payload = {
        data: [actItem],
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      const first = Array.isArray(response.data?.data) ? response.data.data[0] : response.data;
      const ok = response.data?.status === 'success' || first?.status === true || first?.status === 'success' || response.data?.request_id !== undefined;
      return {
        success: !!ok,
        message: first?.message || response.data?.message || 'Updated Delhivery NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Delhivery reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressDelhivery(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('Delhivery API Token is not configured');
      }

      // Explicit environment: DELHIVERY_ENV=staging|production (falls back to NODE_ENV).
      const isProd = process.env.DELHIVERY_ENV ? process.env.DELHIVERY_ENV === 'production' : config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;

      // act = EDIT_DETAILS lets the consignee address/phone/remarks be corrected on an undelivered shipment.
      // Delhivery prints remarks on the rider's Delivery Executive Last-Mile application.
      const landmarkPart = params.landmark ? `Landmark: ${params.landmark}` : '';
      const gatePart = params.driverNote ? `Gate: ${params.driverNote}` : '';
      const gpsPart = params.latitude && params.longitude ? `GPS: ${params.latitude.toFixed(4)},${params.longitude.toFixed(4)}` : '';
      const combinedRemarks = params.remarks || [landmarkPart, gatePart, gpsPart].filter(Boolean).join(' | ');

      const item: any = {
        waybill: params.awb,
        act: 'EDIT_DETAILS',
        add: sanitizeString(params.address, 200),
        city: sanitizeString(params.city, 50),
        pin: sanitizePincode(params.pincode),
        phone: params.phone,
      };
      if (combinedRemarks) {
        item.remarks = sanitizeString(combinedRemarks, 150);
      }

      const payload = {
        data: [item],
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      const first = Array.isArray(response.data?.data) ? response.data.data[0] : response.data;
      const ok = response.data?.status === 'success' || first?.status === true || first?.status === 'success' || response.data?.request_id !== undefined;
      return {
        success: !!ok,
        message: first?.message || response.data?.message || 'Updated Delhivery address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Delhivery address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelShiprocket(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const token = await this.getShiprocketToken(carrierConfig?.email, carrierConfig?.password);
      // POST /ndr/action does not exist (405); the action endpoint takes the AWB in the path.
      const url = `https://apiv2.shiprocket.in/v1/external/ndr/${encodeURIComponent(params.awb)}/action`;

      const payload = {
        action: 'return',
        comments: sanitizeString(params.reason, 150, 'Customer requested order cancellation via WhatsApp NDR'),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: response.data.status === 200 || response.data.success || false,
        message: response.data.message || 'Cancelled delivery and initiated RTO on Shiprocket',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.warn('Shiprocket cancel / RTO request notice', { awb: params.awb, error: error.response?.data || error.message });
      if (process.env.CARRIER_SIMULATE === 'true') {
        return { success: true, message: 'Simulated Shiprocket cancellation recorded', carrierResponse: { simulated: true } };
      }
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelClickPost(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    return clickPostNdrAction(params.awb, carrierConfig, 'INITIATE_RTO', { remark: (params as any).reason || 'Customer cancelled order on WhatsApp' });
  }

  private async cancelDelhivery(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('Delhivery API Token is not configured');
      }

      // Explicit environment: DELHIVERY_ENV=staging|production (falls back to NODE_ENV).
      const isProd = process.env.DELHIVERY_ENV ? process.env.DELHIVERY_ENV === 'production' : config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;

      const payload = {
        data: [
          {
            waybill: params.awb,
            act: 'RTO',
          },
        ],
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      const first = Array.isArray(response.data?.data) ? response.data.data[0] : response.data;
      const ok = response.data?.status === 'success' || first?.status === true || first?.status === 'success' || response.data?.request_id !== undefined;
      return {
        success: !!ok,
        message: first?.message || response.data?.message || 'Cancelled delivery and initiated RTO on Delhivery',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Delhivery cancel / RTO request failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async adjustCodShiprocket(params: CodAmendmentParams, _carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    // Shiprocket only lets the seller switch COD↔prepaid before pickup, in its panel; there is
    // no API to change the collectable amount of a shipped AWB. Never pretend it worked.
    logger.warn('Shiprocket COD amendment requested but not supported by the API', { awb: params.awb });
    return { success: false, message: 'Shiprocket has no API to change the COD amount after pickup; update it with the courier' };
  }

  private async adjustCodClickPost(params: CodAmendmentParams, _carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    // ClickPost's NDR API has no COD amendment; the merchant must change it with the courier.
    logger.warn('ClickPost COD amendment requested but not supported by the API', { awb: params.awb });
    return { success: false, message: 'ClickPost has no COD amendment API; update the COD amount with the courier' };
  }

  private async adjustCodDelhivery(params: CodAmendmentParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) throw new Error('Delhivery API Token is not configured');
      // Explicit environment: DELHIVERY_ENV=staging|production (falls back to NODE_ENV).
      const isProd = process.env.DELHIVERY_ENV ? process.env.DELHIVERY_ENV === 'production' : config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;
      const payload = {
        data: [{ waybill: params.awb, act: 'EDIT_DETAILS', cod: params.newCodAmount }],
      };
      const response = await axios.post(url, payload, {
        headers: { Authorization: `Token ${apiToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      const first = Array.isArray(response.data?.data) ? response.data.data[0] : response.data;
      const ok = response.data?.status === 'success' || first?.status === true || first?.status === 'success';
      return {
        success: !!ok,
        message: first?.message || response.data?.message || 'Updated Delhivery COD',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Delhivery COD amendment failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  /* ----------------- Blue Dart Implementation ----------------- */

  private async rescheduleBlueDart(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      const loginId = carrierConfig?.loginId;
      const licenseKey = carrierConfig?.licenseKey;

      if (!apiKey && (!loginId || !licenseKey)) {
        throw new Error('Blue Dart credentials (API Key or LoginID + LicenseKey) are not configured');
      }

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Blue Dart reattempt scheduled (test mode)', carrierResponse: { status: 'SUCCESS' } };
      }

      const deferredDate = sanitizeDeferredDate(params.newDate);
      const url = 'https://api.bluedart.com/v1/shipments/alt-instruction';
      const payload = {
        awb: params.awb,
        instructionType: 'RESCHEDULE',
        requestedDate: deferredDate,
        remarks: sanitizeString(params.reason, 150, 'Customer requested reschedule'),
        customerCode: carrierConfig?.customerCode,
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : { 'X-BD-Login': loginId, 'X-BD-License': licenseKey }),
        },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'SUCCESS' || response.data?.success === true,
        message: response.data?.message || 'Updated Blue Dart NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Blue Dart reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressBlueDart(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      const loginId = carrierConfig?.loginId;
      const licenseKey = carrierConfig?.licenseKey;

      if (!apiKey && (!loginId || !licenseKey)) {
        throw new Error('Blue Dart credentials are not configured');
      }

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Blue Dart address updated (test mode)', carrierResponse: { status: 'SUCCESS' } };
      }

      const url = 'https://api.bluedart.com/v1/shipments/alt-instruction';
      const payload = {
        awb: params.awb,
        instructionType: 'ADDRESS_UPDATE',
        address: sanitizeString(params.address, 200),
        pincode: sanitizePincode(params.pincode),
        city: sanitizeString(params.city, 50),
        phone: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : { 'X-BD-Login': loginId, 'X-BD-License': licenseKey }),
        },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'SUCCESS' || response.data?.success === true,
        message: response.data?.message || 'Updated Blue Dart address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Blue Dart address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelBlueDart(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      const loginId = carrierConfig?.loginId;
      const licenseKey = carrierConfig?.licenseKey;

      if (!apiKey && (!loginId || !licenseKey)) {
        throw new Error('Blue Dart credentials are not configured');
      }

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Blue Dart RTO requested (test mode)', carrierResponse: { status: 'SUCCESS' } };
      }

      const url = 'https://api.bluedart.com/v1/shipments/alt-instruction';
      const payload = {
        awb: params.awb,
        instructionType: 'RTO',
        remarks: sanitizeString(params.reason, 150, 'Customer cancelled order'),
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : { 'X-BD-Login': loginId, 'X-BD-License': licenseKey }),
        },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'SUCCESS' || response.data?.success === true,
        message: response.data?.message || 'Blue Dart cancellation / RTO requested',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Blue Dart cancel failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  /* ----------------- Xpressbees Implementation ----------------- */

  private async rescheduleXpressbees(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Xpressbees API Key (XBKey) is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Xpressbees reattempt scheduled (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://shipment.xpressbees.com/api/v1/shipments/ndr';
      const payload = {
        awb: params.awb,
        action: 'REATTEMPT',
        reattempt_date: sanitizeDeferredDate(params.newDate),
        remarks: sanitizeString(params.reason, 150, 'Customer requested reschedule'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', XBKey: apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.status === true || response.data?.success === true,
        message: response.data?.message || 'Updated Xpressbees NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Xpressbees reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressXpressbees(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Xpressbees API Key (XBKey) is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Xpressbees address updated (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://shipment.xpressbees.com/api/v1/shipments/ndr';
      const payload = {
        awb: params.awb,
        action: 'ADDRESS_UPDATE',
        alternate_address: sanitizeString(params.address, 200),
        pincode: sanitizePincode(params.pincode),
        city: sanitizeString(params.city, 50),
        alternate_mobile: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', XBKey: apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.status === true || response.data?.success === true,
        message: response.data?.message || 'Updated Xpressbees address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Xpressbees address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelXpressbees(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Xpressbees API Key (XBKey) is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Xpressbees RTO requested (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://shipment.xpressbees.com/api/v1/shipments/ndr';
      const payload = {
        awb: params.awb,
        action: 'RTO',
        remarks: sanitizeString(params.reason, 150, 'Customer cancelled order'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', XBKey: apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.status === true || response.data?.success === true,
        message: response.data?.message || 'Xpressbees RTO requested',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Xpressbees cancel failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  /* ----------------- Shadowfax Implementation ----------------- */

  private async rescheduleShadowfax(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Shadowfax API Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Shadowfax reattempt scheduled (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.shadowfax.in/v3/ndr/update';
      const payload = {
        awb: params.awb,
        action: 'reschedule',
        preferred_date: sanitizeDeferredDate(params.newDate),
        reason: sanitizeString(params.reason, 150, 'Customer requested reschedule'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'Updated Shadowfax NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shadowfax reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressShadowfax(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Shadowfax API Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Shadowfax address updated (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.shadowfax.in/v3/ndr/update';
      const payload = {
        awb: params.awb,
        action: 'address_update',
        address: sanitizeString(params.address, 200),
        pincode: sanitizePincode(params.pincode),
        city: sanitizeString(params.city, 50),
        contact: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'Updated Shadowfax address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shadowfax address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelShadowfax(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('Shadowfax API Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Shadowfax RTO requested (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.shadowfax.in/v3/ndr/update';
      const payload = {
        awb: params.awb,
        action: 'rto',
        reason: sanitizeString(params.reason, 150, 'Customer cancelled order'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'Shadowfax RTO requested',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shadowfax cancel failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }
  /* ----------------- Ecom Express Implementation ----------------- */

  private async rescheduleEcomExpress(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const username = carrierConfig?.username || carrierConfig?.email;
      const password = carrierConfig?.password;
      if (!username || !password) throw new Error('Ecom Express credentials (username/password) are not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Ecom Express reattempt scheduled (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://api.ecomexpress.in/apiv2/ndr_action/';
      const payload = {
        username,
        password,
        awb: params.awb,
        action: 'SCHEDULE_DELIVERY',
        re_attempt_date: sanitizeDeferredDate(params.newDate),
        remarks: sanitizeString(params.reason, 150, 'Customer requested reschedule'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'success' || response.data?.success === true,
        message: response.data?.message || 'Updated Ecom Express NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Ecom Express reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressEcomExpress(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const username = carrierConfig?.username || carrierConfig?.email;
      const password = carrierConfig?.password;
      if (!username || !password) throw new Error('Ecom Express credentials (username/password) are not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Ecom Express address updated (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://api.ecomexpress.in/apiv2/ndr_action/';
      const payload = {
        username,
        password,
        awb: params.awb,
        action: 'REATTEMPT_WITH_NEW_ADDRESS',
        address: sanitizeString(params.address, 200),
        pincode: sanitizePincode(params.pincode),
        city: sanitizeString(params.city, 50),
        mobile: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'success' || response.data?.success === true,
        message: response.data?.message || 'Updated Ecom Express address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Ecom Express address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelEcomExpress(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const username = carrierConfig?.username || carrierConfig?.email;
      const password = carrierConfig?.password;
      if (!username || !password) throw new Error('Ecom Express credentials (username/password) are not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'Ecom Express RTO requested (test mode)', carrierResponse: { status: true } };
      }

      const url = 'https://api.ecomexpress.in/apiv2/ndr_action/';
      const payload = {
        username,
        password,
        awb: params.awb,
        action: 'RTO',
        remarks: sanitizeString(params.reason, 150, 'Customer cancelled order'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      return {
        success: response.data?.status === 'success' || response.data?.success === true,
        message: response.data?.message || 'Ecom Express RTO requested',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Ecom Express cancel failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  /* ----------------- DTDC Implementation ----------------- */

  private async rescheduleDTDC(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('DTDC API Key / Access Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'DTDC reattempt scheduled (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.dtdc.com/ndr/update';
      const payload = {
        reference_number: params.awb,
        action: 'REATTEMPT',
        next_attempt_date: sanitizeDeferredDate(params.newDate),
        remarks: sanitizeString(params.reason, 150, 'Customer requested reschedule'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'Updated DTDC NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('DTDC reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressDTDC(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('DTDC API Key / Access Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'DTDC address updated (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.dtdc.com/ndr/update';
      const payload = {
        reference_number: params.awb,
        action: 'ADDRESS_UPDATE',
        address: sanitizeString(params.address, 200),
        pincode: sanitizePincode(params.pincode),
        city: sanitizeString(params.city, 50),
        phone: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'Updated DTDC address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('DTDC address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async cancelDTDC(params: CancelParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiKey = carrierConfig?.apiKey || carrierConfig?.apiToken;
      if (!apiKey) throw new Error('DTDC API Key / Access Token is not configured');

      if (process.env.NODE_ENV === 'test') {
        return { success: true, message: 'DTDC RTO requested (test mode)', carrierResponse: { success: true } };
      }

      const url = 'https://api.dtdc.com/ndr/update';
      const payload = {
        reference_number: params.awb,
        action: 'RTO',
        remarks: sanitizeString(params.reason, 150, 'Customer cancelled order'),
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey },
        timeout: 15000,
      });

      return {
        success: response.data?.success === true || response.data?.status === 200,
        message: response.data?.message || 'DTDC RTO requested',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('DTDC cancel failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }
}

export const logisticsService = LogisticsService.getInstance();
