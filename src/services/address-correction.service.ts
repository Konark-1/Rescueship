/**
 * address-correction.service.ts
 * ─────────────────────────────────────────────────────────────
 * Full 3-Mode Smart Address Correction:
 *
 *   Mode 1: 📍 Location Pin → reverse-geocode → push to carrier
 *   Mode 2: ✏️ Text Address → parse pincode → push to carrier
 *   Mode 3: 📍+✏️ Both → Step 1: GPS → Step 2: Text → Combined → push
 *
 * State machine on Order.ndr:
 *   addressMode: 'location_pin' | 'text_address' | 'both'
 *   addressCorrectionStep: 1 | 2 | 'awaiting_location' | 'awaiting_text' | 'done'
 */

import { Order, Merchant, AuditLog } from '../models';
import { whatsAppService } from './whatsapp.service';
import { logisticsService } from './logistics.service';
import { geocodingService } from './geocoding.service';
import { encryptionService } from './encryption.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';

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

    if (mode === 'location_pin') {
      await this.requestLocationPin(order, lang, waConfig);
      order.ndr = order.ndr || ({} as any);
      (order.ndr as any).addressMode = 'location_pin';
      (order.ndr as any).addressCorrectionStep = 'awaiting_location';
      await order.save();

    } else if (mode === 'text_address') {
      await this.requestTextAddress(order, lang, waConfig);
      order.ndr = order.ndr || ({} as any);
      (order.ndr as any).addressMode = 'text_address';
      (order.ndr as any).addressCorrectionStep = 'awaiting_text';
      await order.save();

    } else {
      // BOTH mode: Step 1 → Ask for GPS pin first
      const msg = lang === 'hi'
        ? '📍 *Step 1/2:* कृपया अपनी सही लोकेशन पिन शेयर करें。\n\nWhatsApp में 📎 (Attach) > Location > "Send Current Location" पर टैप करें।'
        : '📍 *Step 1/2:* Please share your exact delivery location pin.\n\nIn WhatsApp, tap 📎 (Attach) > Location > "Send Current Location" or drop a pin on your building.';

      await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);

      order.ndr = order.ndr || ({} as any);
      (order.ndr as any).addressMode = 'both';
      (order.ndr as any).addressCorrectionStep = 1;
      await order.save();
    }

    logger.info('Address correction initiated', { orderId, mode });
  }

  /**
   * Handle incoming GPS location from customer.
   * Called from whatsapp.webhook.ts when parsed.type === 'location'
   *
   * @returns true if handled, false if no matching order found
   */
  public async handleLocationResponse(phone: string, location: LocationData): Promise<boolean> {
    const normalizedPhone = normalizeIndianPhone(phone);

    const order = await Order.findOne({
      customerPhone: normalizedPhone,
      status: 'ndr_rescue_sent',
      $or: [
        { 'ndr.addressCorrectionStep': 1 },
        { 'ndr.addressCorrectionStep': 'awaiting_location' },
      ],
    }).sort({ updatedAt: -1 });

    if (!order) {
      logger.info('Location received but no order awaiting GPS', { phone });
      return false;
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const lang = merchant.settings?.ndrRescue?.messageLanguage || 'en';
    const waConfig = this.getWaConfig(merchant);

    try {
      // Reverse geocode the GPS coordinates
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

      const mode = (order.ndr as any)?.addressMode;

      if (mode === 'both') {
        // BOTH mode: Store GPS, move to Step 2 (ask for text details)
        (order.ndr as any).gpsCoordinates = {
          lat: location.latitude,
          lng: location.longitude,
        };
        (order.ndr as any).geocodedAddress = geocodedAddress;
        (order.ndr as any).addressCorrectionStep = 2;
        await order.save();

        const step2Msg = lang === 'hi'
          ? '✅ लोकेशन मिल गया!\n\n📝 *Step 2/2:* अब कृपया अपने बिल्डिंग का पूरा पता लिखें:\n- फ्लोर / टावर / रूम नंबर\n- बिल्डिंग का नाम\n- नजदीकी लैंडमार्क\n- पिनकोड (6 अंक)'
          : '✅ Location received!\n\n📝 *Step 2/2:* Now please type your building details:\n- Floor / Tower / Room number\n- Building name\n- Nearby landmark\n- Pincode (6 digits)';

        await whatsAppService.sendInteractiveButtons(order.customerPhone, step2Msg, [], waConfig);

      } else {
        // LOCATION PIN mode: Push directly to carrier
        await this.pushAddressToCarrier(order, merchant, {
          address: geocodedAddress,
          lat: location.latitude,
          lng: location.longitude,
          pincode: this.extractPincode(geocodedAddress),
        });

        (order.ndr as any).addressCorrectionStep = 'done';
        (order.ndr as any).resolution = 'location_pin_updated';
        await order.save();

        const confirmMsg = lang === 'hi'
          ? '✅ धन्यवाद! हमने आपकी लोकेशन कूरियर को भेज दी है। 🚚'
          : '✅ Thank you! We have shared your location with the courier driver. 🚚';

        await whatsAppService.sendInteractiveButtons(order.customerPhone, confirmMsg, [], waConfig);
        await this.cancelEscalationJobs(order, merchant);
      }

      return true;
    } catch (err: any) {
      logger.error('Failed to process location response', {
        orderId: order._id,
        error: err.message,
      });

      const errMsg = lang === 'hi'
        ? '⚠️ लोकेशन प्रोसेस नहीं हो पाया। कृपया दोबारा अपनी लोकेशन पिन शेयर करें।'
        : '⚠️ Could not process your location. Please try sharing your location pin again.';

      await whatsAppService.sendInteractiveButtons(order.customerPhone, errMsg, [], waConfig);
      return true;
    }
  }

  /**
   * Handle text address response (Step 2 of Both mode, or Text Address mode).
   *
   * @returns true if handled, false if no matching order found
   */
  public async handleTextAddressResponse(phone: string, text: string): Promise<boolean> {
    const normalizedPhone = normalizeIndianPhone(phone);

    const order = await Order.findOne({
      customerPhone: normalizedPhone,
      status: 'ndr_rescue_sent',
      $or: [
        { 'ndr.addressCorrectionStep': 2 },
        { 'ndr.addressCorrectionStep': 'awaiting_text' },
      ],
    }).sort({ updatedAt: -1 });

    if (!order) {
      return false; // Not an address correction text — let NDR service handle it
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const lang = merchant.settings?.ndrRescue?.messageLanguage || 'en';
    const waConfig = this.getWaConfig(merchant);

    try {
      const pincode = this.extractPincode(text);
      const gpsCoords = (order.ndr as any)?.gpsCoordinates;
      const geocodedAddress = (order.ndr as any)?.geocodedAddress;

      // Build combined address (GPS + text details)
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

      (order.ndr as any).addressCorrectionStep = 'done';
      (order.ndr as any).resolution = (order.ndr as any)?.addressMode === 'both'
        ? 'both_mode_address_updated'
        : 'text_address_updated';
      (order.ndr as any).customerProvidedAddress = text;
      await order.save();

      const confirmMsg = lang === 'hi'
        ? '✅ धन्यवाद! आपका पता अपडेट हो गया है और कूरियर को सूचित कर दिया गया है। 🚚'
        : '✅ Thank you! Your address has been updated and the courier has been notified. 🚚';

      await whatsAppService.sendInteractiveButtons(order.customerPhone, confirmMsg, [], waConfig);
      await this.cancelEscalationJobs(order, merchant);

      return true;
    } catch (err: any) {
      logger.error('Failed to process text address', {
        orderId: order._id,
        error: err.message,
      });

      const errMsg = lang === 'hi'
        ? '⚠️ पता अपडेट विफल। कृपया एक मान्य 6-अंकी पिनकोड के साथ दोबारा पूरा पता भेजें।'
        : '⚠️ Address update failed. Please reply again with your complete address including a valid 6-digit pincode.';

      await whatsAppService.sendInteractiveButtons(order.customerPhone, errMsg, [], waConfig);
      return true;
    }
  }

  /**
   * Push the corrected address (+ optional GPS coords) to the carrier API.
   */
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

    const carrierConfig = {
      provider: order.carrier || merchant.carrierConfig?.provider,
      apiToken,
      email: (merchant.carrierConfig as any)?.email,
      password: (merchant.carrierConfig as any)?.password,
    };

    if (!order.carrier || !order.awb) {
      throw new Error('Order has no carrier or AWB assigned');
    }

    const result = await logisticsService.updateDeliveryAddress(
      order.carrier,
      {
        awb: order.awb,
        address: addressData.address,
        city: '',
        pincode: addressData.pincode || '',
        phone: order.customerPhone,
        customerName: order.customerName || 'Customer',
        latitude: addressData.lat,
        longitude: addressData.lng,
      } as any,
      carrierConfig
    );

    if (!result.success) {
      throw new Error(`Carrier rejected address update: ${result.message}`);
    }

    // Update order status
    order.status = 'ndr_rescued';
    if (order.ndr) {
      (order.ndr as any).resolvedAt = new Date();
    }

    // Increment merchant rescue stats
    await Merchant.findByIdAndUpdate(order.merchantId, {
      $inc: { 'billing.totalRescues': 1 },
    });

    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: 'address_corrected_via_3mode',
      source: 'address_correction_service',
      payload: {
        mode: (order.ndr as any)?.addressMode,
        address: addressData.address,
        pincode: addressData.pincode,
        gps: addressData.lat ? { lat: addressData.lat, lng: addressData.lng } : null,
      },
      status: 'success',
    });
  }

  private async cancelEscalationJobs(order: any, merchant: any): Promise<void> {
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
    } catch (err: any) {
      logger.warn('Failed to cancel escalation jobs', { error: err.message });
    }
  }

  private async requestLocationPin(order: any, lang: string, waConfig: any): Promise<void> {
    const msg = lang === 'hi'
      ? '📍 कृपया अपनी सही डिलीवरी लोकेशन पिन शेयर करें।\n\nWhatsApp में 📎 > Location > "Send Current Location" पर टैप करें।'
      : '📍 Please share your exact delivery location pin.\n\nIn WhatsApp, tap 📎 (Attach) > Location > "Send Current Location".';
    await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);
  }

  private async requestTextAddress(order: any, lang: string, waConfig: any): Promise<void> {
    const msg = lang === 'hi'
      ? '📝 कृपया अपना पूरा डिलीवरी पता लिखें (फ्लोर, टावर, लैंडमार्क, पिनकोड)।'
      : '📝 Please type your complete delivery address (floor, tower, landmark, pincode).';
    await whatsAppService.sendInteractiveButtons(order.customerPhone, msg, [], waConfig);
  }

  private extractPincode(text: string): string {
    const match = text.match(/\b\d{6}\b/);
    return match ? match[0] : '';
  }

  private getWaConfig(merchant: any): any {
    let waToken: string | undefined;
    try {
      if (merchant.whatsappConfig?.accessToken) {
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      }
    } catch (err) {
      waToken = merchant.whatsappConfig?.accessToken;
    }
    return {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
    };
  }
}

export const addressCorrectionService = AddressCorrectionService.getInstance();
