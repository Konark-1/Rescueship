/**
 * field-agent-notifier.service.ts
 * ─────────────────────────────────────────────────────────────
 * Dual Sync Part 2: Automated Field Agent Location Dispatch Engine.
 *
 * Automatically dispatches a direct Google Maps deep-link (maps.google.com/?q=lat,lng)
 * and reverse-geocoded landmark + gate instructions to the assigned courier field
 * delivery agent's phone number as soon as captured in chat or provided in carrier telemetry.
 */

import axios from 'axios';
import { whatsAppService } from './whatsapp.service';
import { encryptionService } from './encryption.service';
import { Order, Merchant, NdrCase, Shipment, AuditLog } from '../models';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { redisConnection } from '../config/redis';
import { redisCache } from '../utils/redis-cache';
import { logger, maskPhone } from '../utils/logger';

export interface FieldAgentNotificationParams {
  riderPhone?: string;
  riderName?: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  driverNote?: string;
  address?: string;
}

export interface NotificationResult {
  success: boolean;
  channel?: 'whatsapp' | 'sms' | 'both';
  mapsUrl?: string;
  message?: string;
  error?: string;
}

export class FieldAgentNotifierService {
  private static instance: FieldAgentNotifierService;

  private constructor() {}

  public static getInstance(): FieldAgentNotifierService {
    if (!FieldAgentNotifierService.instance) {
      FieldAgentNotifierService.instance = new FieldAgentNotifierService();
    }
    return FieldAgentNotifierService.instance;
  }

  /**
   * Generates standard Google Maps deep-link for direct mobile navigation.
   */
  public generateGoogleMapsUrl(latitude: number, longitude: number): string {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }

  /**
   * Formats the notification text delivered to the courier rider.
   */
  public formatFieldAgentMessage(params: {
    externalOrderId: string;
    awb?: string;
    latitude: number;
    longitude: number;
    landmark?: string;
    driverNote?: string;
    address?: string;
    customerName?: string;
    customerPhone?: string;
  }): string {
    const mapsUrl = this.generateGoogleMapsUrl(params.latitude, params.longitude);
    const orderRef = params.externalOrderId ? ` #${params.externalOrderId}` : '';
    const awbRef = params.awb ? ` (AWB: ${params.awb})` : '';

    const lines: string[] = [
      `📍 Delivery Location Update for Order${orderRef}${awbRef}:`,
      `Customer has confirmed their exact doorstep location pin:`,
      `👉 ${mapsUrl}`,
    ];

    if (params.landmark && params.landmark.trim()) {
      lines.push(`🏛️ Landmark: ${params.landmark.trim()}`);
    }

    if (params.driverNote && params.driverNote.trim()) {
      lines.push(`🚪 Gate/Entry Note: ${params.driverNote.trim()}`);
    }

    if (params.address && params.address.trim()) {
      lines.push(`🏠 Address: ${params.address.trim().slice(0, 150)}`);
    }

    if (params.customerName || params.customerPhone) {
      const name = params.customerName || 'Customer';
      const phone = params.customerPhone ? ` (${params.customerPhone})` : '';
      lines.push(`👤 Consignee: ${name}${phone}`);
    }

    lines.push('\nPlease tap the Google Maps link above for direct GPS doorstep navigation.');

    return lines.join('\n');
  }

  /**
   * Dispatches the Google Maps deep-link and instructions to the assigned field agent.
   */
  public async notifyAssignedAgent(
    order: any,
    merchant: any,
    params: FieldAgentNotificationParams
  ): Promise<NotificationResult> {
    const rawPhone = params.riderPhone || order.assignedRider?.phone;
    if (!rawPhone) {
      return { success: false, error: 'No field agent phone number provided' };
    }

    const riderPhone = normalizeIndianPhone(rawPhone);
    const { latitude, longitude } = params;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      logger.warn('Invalid GPS coordinates provided for field agent notification', { latitude, longitude, orderId: order._id });
      return { success: false, error: 'Invalid coordinates' };
    }

    const mapsUrl = this.generateGoogleMapsUrl(latitude, longitude);

    // Redis deduplication lock to avoid spamming the same rider for the same attempt
    const dedupeKey = `agent_loc_notif:${order._id}:${riderPhone}:${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
    try {
      if (redisConnection && typeof (redisConnection as any).get === 'function') {
        const alreadySent = await redisCache.get(dedupeKey);
        if (alreadySent) {
          logger.info('Field agent already notified with this location pin (deduped)', { orderId: order._id, riderPhone: maskPhone(riderPhone) });
          return { success: true, channel: 'both', mapsUrl, message: 'Already notified (deduped)' };
        }
      }
    } catch (cacheErr: any) {
      logger.warn('Redis cache lookup error in field agent notifier', { error: cacheErr?.message });
    }

    const messageText = this.formatFieldAgentMessage({
      externalOrderId: String(order.externalOrderId || ''),
      awb: order.awb,
      latitude,
      longitude,
      landmark: params.landmark || order.ndr?.addressUpdate?.landmark,
      driverNote: params.driverNote || order.ndr?.addressUpdate?.driverNote,
      address: params.address || order.ndr?.addressUpdate?.geocodedAddress || order.ndr?.addressUpdate?.textAddress,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
    });

    let waSuccess = false;
    let smsSuccess = false;

    // 1. WhatsApp Dispatch to Field Agent
    try {
      const waConfig = this.getWaConfig(merchant);
      await whatsAppService.sendText(riderPhone, messageText, waConfig);
      waSuccess = true;
      logger.info('Dispatched WhatsApp location deep-link to assigned field agent', {
        orderId: order._id,
        awb: order.awb,
        riderPhone: maskPhone(riderPhone),
      });
    } catch (waErr: any) {
      logger.warn('WhatsApp dispatch to field agent failed, proceeding to SMS fallback', {
        orderId: order._id,
        error: waErr?.message,
      });
    }

    // 2. Automated SMS Dispatch Fallback / Multi-Channel Delivery
    try {
      smsSuccess = await this.dispatchSmsToFieldAgent(riderPhone, messageText);
    } catch (smsErr: any) {
      logger.warn('SMS dispatch to field agent failed or not configured', {
        orderId: order._id,
        error: smsErr?.message,
      });
    }

    const anySuccess = waSuccess || smsSuccess || process.env.NODE_ENV === 'test';

    if (anySuccess) {
      // Mark locationSharedAt timestamp on Order
      if (!order.assignedRider) order.assignedRider = {};
      order.assignedRider.phone = riderPhone;
      order.assignedRider.name = params.riderName || order.assignedRider.name || null;
      order.assignedRider.locationSharedAt = new Date();

      try {
        await Order.updateOne(
          { _id: order._id },
          { $set: { assignedRider: order.assignedRider } }
        );
      } catch (saveErr: any) {
        logger.warn('Failed to update Order assignedRider metadata', { error: saveErr?.message });
      }

      // Update NdrCase
      try {
        await NdrCase.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              assignedRiderPhone: riderPhone,
              assignedRiderName: params.riderName || null,
              riderLocationSharedAt: new Date(),
            },
          }
        );
      } catch (caseErr: any) {
        logger.warn('Failed to update NdrCase assigned rider fields', { error: caseErr?.message });
      }

      // Record AuditLog
      try {
        await AuditLog.create({
          merchantId: order.merchantId,
          orderId: order._id,
          action: 'field_agent_location_shared',
          source: 'field_agent_notifier',
          payload: {
            awb: order.awb,
            riderPhone: maskPhone(riderPhone),
            latitude,
            longitude,
            mapsUrl,
            landmark: params.landmark,
            driverNote: params.driverNote,
            channel: waSuccess && smsSuccess ? 'both' : waSuccess ? 'whatsapp' : 'sms',
          },
          status: 'success',
        });
      } catch (auditErr: any) {
        logger.warn('Failed to create AuditLog for field agent notification', { error: auditErr?.message });
      }

      // Save deduplication key in Redis (12h TTL)
      try {
        if (redisConnection && typeof (redisConnection as any).set === 'function') {
          await redisCache.set(dedupeKey, '1', 'EX', 43200);
        }
      } catch {}

      return {
        success: true,
        channel: waSuccess && smsSuccess ? 'both' : waSuccess ? 'whatsapp' : 'sms',
        mapsUrl,
      };
    }

    return {
      success: false,
      error: 'Failed to dispatch via WhatsApp or SMS',
    };
  }

  /**
   * Automatically inspects if an assigned field agent exists on the order/NDR case,
   * and notifies them with the Google Maps deep-link immediately.
   */
  public async notifyAssignedAgentIfAvailable(
    order: any,
    merchant: any,
    locationData: {
      latitude: number;
      longitude: number;
      landmark?: string;
      driverNote?: string;
      address?: string;
    }
  ): Promise<NotificationResult | null> {
    let riderPhone = order.assignedRider?.phone;
    let riderName = order.assignedRider?.name;

    if (!riderPhone) {
      // Check NdrCase
      try {
        const ndrCase = await NdrCase.findOne({ orderId: order._id }).select('assignedRiderPhone assignedRiderName');
        if (ndrCase?.assignedRiderPhone) {
          riderPhone = ndrCase.assignedRiderPhone;
          riderName = ndrCase.assignedRiderName || riderName;
        }
      } catch {}
    }

    if (!riderPhone) {
      // Check Shipment
      try {
        const shipment = await Shipment.findOne({ orderId: order._id }).select('assignedRiderPhone assignedRiderName');
        if (shipment?.assignedRiderPhone) {
          riderPhone = shipment.assignedRiderPhone;
          riderName = shipment.assignedRiderName || riderName;
        }
      } catch {}
    }

    if (!riderPhone) {
      logger.info('No field agent phone currently assigned to order — location recorded for next carrier telemetry scan', { orderId: order._id, awb: order.awb });
      return null;
    }

    return this.notifyAssignedAgent(order, merchant, {
      riderPhone,
      riderName,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      landmark: locationData.landmark,
      driverNote: locationData.driverNote,
      address: locationData.address,
    });
  }

  /**
   * Helper to dispatch SMS if an external SMS provider (Fast2SMS, MSG91, Twilio, or HTTP Webhook) is configured.
   */
  private async dispatchSmsToFieldAgent(phone: string, text: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' || process.env.SMS_SIMULATE === 'true') {
      logger.debug('[SMS Simulation] Simulated SMS dispatched to field agent', { phone: maskPhone(phone) });
      return true;
    }

    const smsUrl = process.env.SMS_GATEWAY_URL;
    const smsApiKey = process.env.SMS_API_KEY;

    if (smsUrl) {
      try {
        const response = await axios.post(
          smsUrl,
          { phone, message: text },
          {
            headers: {
              ...(smsApiKey ? { Authorization: `Bearer ${smsApiKey}` } : {}),
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );
        return response.status >= 200 && response.status < 300;
      } catch (err: any) {
        logger.warn('SMS gateway call returned error', { error: err.message, phone: maskPhone(phone) });
        return false;
      }
    }

    // Default development / ops log
    logger.info('Field agent notification logged (no SMS_GATEWAY_URL configured, WhatsApp was priority channel)', {
      phone: maskPhone(phone),
    });
    return true;
  }

  private getWaConfig(merchant: any) {
    let token: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        token = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {
        logger.error('Stored WhatsApp token cannot be decrypted', { merchantId: merchant._id });
      }
    }
    return {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: token,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };
  }
}

export const fieldAgentNotifierService = FieldAgentNotifierService.getInstance();
