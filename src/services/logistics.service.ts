import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

export type CarrierType = 'shiprocket' | 'clickpost' | 'delhivery';

export interface CarrierConfig {
  provider?: CarrierType;
  apiToken?: string; // For ClickPost / Delhivery, orcached Shiprocket token
  email?: string; // Shiprocket specific
  password?: string; // Shiprocket specific
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
}

export interface RescheduleResult {
  success: boolean;
  message: string;
  carrierResponse?: any;
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
    const srEmail = email || config.shiprocket.email;
    const srPassword = password || config.shiprocket.password;

    if (!srEmail || !srPassword) {
      throw new Error('Shiprocket email and password are not configured');
    }

    // Try to get token from Redis cache first
    const cacheKey = `shiprocket:token:${srEmail}`;
    try {
      const cachedToken = await redisConnection.get(cacheKey);
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
          await redisConnection.set(cacheKey, token, 'EX', 9 * 24 * 60 * 60);
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

    if (carrier === 'shiprocket') {
      return this.rescheduleShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.rescheduleClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.rescheduleDelhivery(params, carrierConfig);
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

    if (carrier === 'shiprocket') {
      return this.updateAddressShiprocket(params, carrierConfig);
    } else if (carrier === 'clickpost') {
      return this.updateAddressClickPost(params, carrierConfig);
    } else if (carrier === 'delhivery') {
      return this.updateAddressDelhivery(params, carrierConfig);
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

  /* ----------------- Carrier Implementations ----------------- */

  private async rescheduleShiprocket(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const token = await this.getShiprocketToken(carrierConfig?.email, carrierConfig?.password);
      // Shiprocket NDR action update endpoint
      const url = 'https://api.shiprocket.in/v1/external/ndr/action';
      
      // Map common reason to Shiprocket NDR action codes (1 = Reattempt, etc.)
      const payload = {
        awb: params.awb,
        action: 'reattempt', // 'reattempt' or 'rto'
        deferred_date: sanitizeDeferredDate(params.newDate),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: response.data.status === 200 || response.data.success || false,
        message: response.data.message || 'Updated Shiprocket NDR status',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shiprocket reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressShiprocket(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const token = await this.getShiprocketToken(carrierConfig?.email, carrierConfig?.password);
      const url = 'https://api.shiprocket.in/v1/external/ndr/action';

      const payload = {
        awb: params.awb,
        action: 'address_update',
        address1: sanitizeString(params.address, 200),
        city: sanitizeString(params.city, 50),
        pin_code: sanitizePincode(params.pincode),
        phone: params.phone,
        name: sanitizeString(params.customerName, 50, 'Customer'),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: response.data.status === 200 || response.data.success || false,
        message: response.data.message || 'Updated Shiprocket address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Shiprocket address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async rescheduleClickPost(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('ClickPost API Token is not configured');
      }

      // ClickPost NDR action update endpoint
      const url = 'https://api.clickpost.in/v1/ndr-update/';
      const payload = {
        awb: params.awb,
        action: 'REATTEMPT', // REATTEMPT or DEFER_DLV
        meta: {
          preferred_date: sanitizeDeferredDate(params.newDate),
          reason: sanitizeString(params.reason, 150, 'Customer request'),
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
      });
      return {
        success: response.data.meta?.status === 'success',
        message: response.data.meta?.message || 'Updated ClickPost NDR',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('ClickPost reschedule failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async updateAddressClickPost(params: AddressUpdateParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('ClickPost API Token is not configured');
      }

      const url = 'https://api.clickpost.in/v1/ndr-update/';
      const payload = {
        awb: params.awb,
        action: 'ADDRESS_UPDATE',
        meta: {
          new_address: sanitizeString(params.address, 200),
          new_pincode: sanitizePincode(params.pincode),
          new_city: sanitizeString(params.city, 50),
          new_phone: params.phone,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
      });
      return {
        success: response.data.meta?.status === 'success',
        message: response.data.meta?.message || 'Updated ClickPost address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('ClickPost address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }

  private async rescheduleDelhivery(params: RescheduleParams, carrierConfig?: CarrierConfig): Promise<RescheduleResult> {
    try {
      const apiToken = carrierConfig?.apiToken;
      if (!apiToken) {
        throw new Error('Delhivery API Token is not configured');
      }

      const isProd = config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;

      // Delhivery requires a date, if missing fallback to tomorrow
      const payload = {
        waybill: params.awb,
        action: 'reattempt', // reattempt
        deferred_date: sanitizeDeferredDate(params.newDate),
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      return {
        success: response.data.status === 'success',
        message: response.data.message || 'Updated Delhivery NDR',
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

      const isProd = config.server.nodeEnv === 'production';
      const baseUrl = isProd ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      const url = `${baseUrl}/api/p/update`;

      const payload = {
        waybill: params.awb,
        action: 'address_update',
        address: sanitizeString(params.address, 200),
        city: sanitizeString(params.city, 50),
        pincode: sanitizePincode(params.pincode),
        phone: params.phone,
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      return {
        success: response.data.status === 'success',
        message: response.data.message || 'Updated Delhivery address',
        carrierResponse: response.data,
      };
    } catch (error: any) {
      logger.error('Delhivery address update failed', { awb: params.awb, error: error.response?.data || error.message });
      return { success: false, message: error.message, carrierResponse: error.response?.data };
    }
  }
}

export const logisticsService = LogisticsService.getInstance();
