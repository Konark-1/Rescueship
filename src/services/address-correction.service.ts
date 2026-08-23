/**
 * address-correction.service.ts
 * ─────────────────────────────────────────────────────────────
 * Full 3-Mode Smart Address Correction:
 *
 *   Mode 1: 📍 Location Pin → reverse-geocode → push to carrier
 *   Mode 2: ✏️ Text Address → parse pincode → push to carrier
 *   Mode 3: 📍+✏️ Both → Step 1: GPS → Step 2: Text → Combined → push
 */

import { Order, Merchant, AuditLog } from '../models';
import { whatsAppService } from './whatsapp.service';
import { logisticsService } from './logistics.service';
import { geocodingService } from './geocoding.service';
import { encryptionService } from './encryption.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export type AddressMode = 'location_pin' | 'text_address' | 'both';

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export class AddressCorrectionService {
  private static instance: AddressCorrectionService;
  private constructor() {}

  public static getInstance(): AddressCorrectionService {
    if (!AddressCorrectionService.instance) {
      AddressCorrectionService.instance = new AddressCorrectionService();
    }
    return AddressCorrectionService.instance;
  }

  /**
   * Initiate the 3-mode address correction flow.
   * Called when customer clicks "Update Address" button in NDR template.
   */
  public async initiateAddressCorrection(
    orderId: string,
    mode: AddressMode = 'both'
  ): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const lang = merchant.settings?.ndrRescue?.messageLanguage || 'en';
    const waConfig = this.getWaConfig(merchant);

    if (!order.ndr) order.ndr = { rescueMessagesSent: 0 } as any;
    if (!order.ndr!.addressUpdate) order.ndr!.addressUpdate = {} as any;

    if (mode === 'location_pin') {
      await this.requestLocationPin(order, lang, waConfig);
      (order.ndr as any).addressMode = 'location_pin';
      (order.ndr as any).addressCorrectionStep = 'awaiting_location';
      order.ndr!.addressUpdate!.collectionState = 'awaiting_location';
      await order.save();

    } else if (mode === 'text_address') {
      await this.requestTextAddress(order, lang, waConfig);
      (order.ndr as any).addressMode = 'text_address';
      (order.ndr as any).addressCorrectionStep = 'awaiting_text';
      order.ndr!.addressUpdate!.collectionState = 'awaiting_text';
      await order.save();

    } else {
      // BOTH mode: Step 1 → Ask for GPS pin first
      const msg = lang === 'hi'
        ? '📍 *Step 1/2:* कृपया अपनी सही लोकेशन पिन शेयर करें。\n\nWhatsApp में 📎 (Attach) > Location > "Send Current Location" पर टैप करें।'
        : '📍 *Step 1/2:* Please share your exact delivery location pin.\n\nIn WhatsApp, tap 📎 (Attach) > Location > "Send Current Location" or drop a pin on your building.';

      await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);

      (order.ndr as any).addressMode = 'both';
      (order.ndr as any).addressCorrectionStep = 1;
      order.ndr!.addressUpdate!.collectionState = 'awaiting_location';
      await order.save();
    }

    logger.info('Address correction initiated', { orderId, mode });
  }

  /**
   * Handle incoming GPS location from customer.
   */
  public async handleLocationResponse(phone: string, location: LocationData, resolvedOrder?: any): Promise<boolean> {
    const normalizedPhone = normalizeIndianPhone(phone);

    let order = resolvedOrder;
    if (!order) {
      const q = Order.findOne({ customerPhone: normalizedPhone });
      order = q && typeof q.sort === 'function' ? await q.sort({ updatedAt: -1 }) : await Order.findOne({ customerPhone: normalizedPhone });
    }

    if (!order) {
      logger.info('Location received but no order awaiting GPS', { phone });
      return false;
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const lang = merchant.settings?.ndrRescue?.messageLanguage || 'en';
    const waConfig = this.getWaConfig(merchant);

    try {
      const geocodedAddress = await geocodingService.reverseGeocode(
        location.latitude,
        location.longitude
      );

      logger.info('Reverse geocoded customer location', {
        orderId: order._id,
        lat: location.latitude,
        lng: location.longitude,
        address: geocodedAddress,
      });

      const mode = (order.ndr as any)?.addressMode || (order.ndr?.addressUpdate?.collectionState === 'awaiting_location' ? 'both' : 'location_pin');

      if (mode === 'both') {
        if (!order.ndr) order.ndr = {};
        if (!order.ndr.addressUpdate) order.ndr.addressUpdate = {};
        order.ndr.addressUpdate.gpsCoordinates = { lat: location.latitude, lng: location.longitude };
        order.ndr.addressUpdate.geocodedAddress = geocodedAddress;
        order.ndr.addressUpdate.collectionState = 'awaiting_text';
        if (typeof order.save === 'function') await order.save();

        if (Order && typeof Order.findOneAndUpdate === 'function') {
          await Order.findOneAndUpdate(
            { _id: order._id },
            {
              $set: {
                'ndr.gpsCoordinates': { lat: location.latitude, lng: location.longitude },
                'ndr.geocodedAddress': geocodedAddress,
                'ndr.addressCorrectionStep': 2,
                'ndr.addressUpdate.collectionState': 'awaiting_text',
                'ndr.addressUpdate.geocodedAddress': geocodedAddress,
              },
            }
          );
        }

        const step2Msg = 'Location pin locked! 📍 Now please reply with your floor, tower, room number, or landmark to complete your address.';
        await whatsAppService.sendInteractiveButtons(order.customerPhone, step2Msg, [], waConfig);

      } else {
        await this.pushAddressToCarrier(order, merchant, {
          address: geocodedAddress,
          lat: location.latitude,
          lng: location.longitude,
          pincode: this.extractPincode(geocodedAddress),
        });

        if (!order.ndr) order.ndr = {};
        if (!order.ndr.addressUpdate) order.ndr.addressUpdate = {};
        order.ndr.addressUpdate.collectionState = 'complete';
        order.status = 'ndr_rescued';
        if (typeof order.save === 'function') await order.save();

        if (Order && typeof Order.findOneAndUpdate === 'function') {
          await Order.findOneAndUpdate(
            { _id: order._id },
            {
              $set: {
                'ndr.addressCorrectionStep': 'done',
                'ndr.resolution': 'location_pin_updated',
                'ndr.addressUpdate.collectionState': 'complete',
                status: 'ndr_rescued',
              },
            }
          );
        }

        const confirmMsg = '✅ Thank you! We have shared your location with the courier driver. 🚚';
        await whatsAppService.sendInteractiveButtons(order.customerPhone, confirmMsg, [], waConfig);
        await this.cancelEscalationJobs(order, merchant);
      }

      return true;
    } catch (err: any) {
      logger.error('Failed to process location response', {
        orderId: order._id,
        error: err.message,
      });

      const errMsg = '⚠️ Could not process your location. Please try sharing your location pin again.';
      await whatsAppService.sendInteractiveButtons(order.customerPhone, errMsg, [], waConfig);
      return true;
    }
  }

  /**
   * Handle text address response.
   */
  public async handleTextAddressResponse(phone: string, text: string, resolvedOrder?: any): Promise<boolean> {
    const normalizedPhone = normalizeIndianPhone(phone);

    let order = resolvedOrder;
    if (!order) {
      const q = Order.findOne({ customerPhone: normalizedPhone });
      order = q && typeof q.sort === 'function' ? await q.sort({ updatedAt: -1 }) : await Order.findOne({ customerPhone: normalizedPhone });
    }

    if (!order) {
      return false;
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const waConfig = this.getWaConfig(merchant);

    try {
      const pincode = this.extractPincode(text);
      const gpsCoords = (order.ndr as any)?.gpsCoordinates;
      const geocodedAddress = (order.ndr as any)?.geocodedAddress || order.ndr?.addressUpdate?.geocodedAddress;

      let fullAddress = text.substring(0, 200);
      if (geocodedAddress) {
        fullAddress = `${text} | GPS: ${geocodedAddress}`;
      }

      await this.pushAddressToCarrier(order, merchant, {
        address: fullAddress,
        lat: gpsCoords?.lat,
        lng: gpsCoords?.lng,
        pincode,
      });

      if (!order.ndr) order.ndr = {};
      if (!order.ndr.addressUpdate) order.ndr.addressUpdate = {};
      order.ndr.addressUpdate.collectionState = 'complete';
      order.ndr.addressUpdate.textAddress = text;
      order.status = 'ndr_rescued';
      if (typeof order.save === 'function') await order.save();

      if (Order && typeof Order.findOneAndUpdate === 'function') {
        await Order.findOneAndUpdate(
          { _id: order._id },
          {
            $set: {
              'ndr.addressCorrectionStep': 'done',
              'ndr.resolution': 'both_mode_address_updated',
              'ndr.customerProvidedAddress': text,
              'ndr.addressUpdate.collectionState': 'complete',
              'ndr.addressUpdate.textAddress': text,
              status: 'ndr_rescued',
            },
          }
        );
      }

      const confirmMsg = '✅ Thank you! Your address has been updated and the courier has been notified. 🚚';
      await whatsAppService.sendInteractiveButtons(order.customerPhone, confirmMsg, [], waConfig);
      await this.cancelEscalationJobs(order, merchant);

      return true;
    } catch (err: any) {
      logger.error('Failed to process text address', {
        orderId: order._id,
        error: err.message,
      });

      const errMsg = '⚠️ Address update failed. Please reply again with your complete address including a valid 6-digit pincode.';
      await whatsAppService.sendInteractiveButtons(order.customerPhone, errMsg, [], waConfig);
      return true;
    }
  }

  private async pushAddressToCarrier(
    order: any,
    merchant: any,
    addressData: { address: string; lat?: number; lng?: number; pincode?: string }
  ): Promise<void> {
    let apiToken: string | undefined;
    try {
      if (merchant.carrierConfig?.apiToken) {
        apiToken = encryptionService.decrypt(merchant.carrierConfig.apiToken);
      }
    } catch (err) {
      apiToken = merchant.carrierConfig?.apiToken;
    }

    let email = config.shiprocket.email;
    let password = config.shiprocket.password;
    try {
      if ((merchant.carrierConfig as any)?.email) {
        email = encryptionService.decrypt((merchant.carrierConfig as any).email);
      }
      if ((merchant.carrierConfig as any)?.password) {
        password = encryptionService.decrypt((merchant.carrierConfig as any).password);
      }
    } catch {
      email = (merchant.carrierConfig as any)?.email || config.shiprocket.email;
      password = (merchant.carrierConfig as any)?.password || config.shiprocket.password;
    }

    const carrierConfig = {
      provider: order.carrier || merchant.carrierConfig?.provider,
      apiToken,
      email,
      password,
    };

    if (order.carrier && order.awb) {
      await logisticsService.updateDeliveryAddress(
        order.carrier,
        {
          awb: order.awb,
          address: addressData.address,
          city: '',
          pincode: addressData.pincode || '',
          phone: order.customerPhone,
          customerName: order.customerName || 'Customer',
        },
        carrierConfig
      );
    }
  }

  private async requestLocationPin(order: any, lang: string, waConfig?: any): Promise<void> {
    const msg = '📍 Please share your exact delivery location pin. In WhatsApp, tap 📎 > Location > Send Current Location.';
    await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);
  }

  private async requestTextAddress(order: any, lang: string, waConfig?: any): Promise<void> {
    const msg = '📝 Please reply with your complete updated address including building details and 6-digit pincode.';
    await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);
  }

  private extractPincode(text: string): string | undefined {
    const match = text.match(/\b[1-9][0-9]{5}\b/);
    return match ? match[0] : undefined;
  }

  private async cancelEscalationJobs(order: any, merchant: any): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const { Queue } = require('bullmq');
      const { redisConnection } = require('../config/redis');
      const eq = new Queue('escalation', { connection: redisConnection });
      const chain = merchant.settings?.ndrRescue?.escalationChain || [4, 12, 24];

      for (let i = 0; i < chain.length; i++) {
        const jobId = `escalation:${order._id}:${i + 1}`;
        const job = await eq.getJob(jobId);
        if (job) await job.remove();
      }
    } catch {
      // ignore
    }
  }

  private getWaConfig(merchant: any) {
    let token: string | undefined;
    try {
      if (merchant.whatsappConfig?.accessToken) {
        token = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      }
    } catch {
      token = merchant.whatsappConfig?.accessToken;
    }
    return {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: token,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };
  }
}

export const addressCorrectionService = AddressCorrectionService.getInstance();
