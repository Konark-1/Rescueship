import { Types } from 'mongoose';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { Merchant, Order, AuditLog, BillingEvent } from '../models';
import { whatsAppService } from './whatsapp.service';
import { logisticsService } from './logistics.service';
import { encryptionService } from './encryption.service';
import { geocodingService } from './geocoding.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { logger } from '../utils/logger';

export interface NDREventData {
  awb: string;
  externalOrderId: string;
  reason: string;
  phone: string;
  carrier: 'shiprocket' | 'clickpost' | 'delhivery';
}

export class NDRService {
  private static instance: NDRService;
  private escalationQueue: Queue | null = null;

  private constructor() {
    // Initialized lazily to avoid circular dependencies during boot
  }

  public static getInstance(): NDRService {
    if (!NDRService.instance) {
      NDRService.instance = new NDRService();
    }
    return NDRService.instance;
  }

  private getEscalationQueue(): Queue {
    if (!this.escalationQueue) {
      this.escalationQueue = new Queue('escalation', { connection: redisConnection as any });
    }
    return this.escalationQueue;
  }

  /**
   * Process incoming NDR webhook event
   */
  public async processNDREvent(merchantId: string, ndrData: NDREventData): Promise<void> {
    logger.info('Processing NDR Event', { merchantId, awb: ndrData.awb, reason: ndrData.reason });

    try {
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      if (!merchant.settings?.ndrRescue?.enabled) {
        logger.info('NDR rescue is disabled for merchant, skipping', { merchantId });
        return;
      }

      if (merchant.billing.rescueCredits <= 0) {
        logger.info('Insufficient rescue credits for NDR rescue', { merchantId });
        return;
      }

      if (merchant.billing.rescueCredits < 20) {
        logger.warn('Low rescue credits warning for merchant', { merchantId, credits: merchant.billing.rescueCredits });
        await AuditLog.create({
          merchantId: merchant._id,
          action: 'low_credits_warning',
          source: 'ndr_service',
          payload: { credits: merchant.billing.rescueCredits },
          status: 'success',
        });
      }

      const normalizedPhone = normalizeIndianPhone(ndrData.phone);

      // Find or create order record
      let order = await Order.findOne({ merchantId: merchant._id, awb: ndrData.awb });
      if (!order) {
        order = await Order.findOne({ merchantId: merchant._id, externalOrderId: ndrData.externalOrderId });
      }

      if (!order) {
        try {
          // Create a new order stub since we received an NDR for an untracked order
          order = await Order.create({
            merchantId: merchant._id,
            externalOrderId: ndrData.externalOrderId,
            platform: merchant.platform,
            customerPhone: normalizedPhone,
            orderValue: 0, // Unknown
            paymentMethod: 'cod', // Default to COD for NDR risk
            status: 'shipped',
            awb: ndrData.awb,
            carrier: ndrData.carrier,
          });
        } catch (err: any) {
          if (err.code === 11000 || err.name === 'MongoServerError' || err.message?.includes('E11000')) {
            logger.info('Duplicate key error encountered during order creation in processNDREvent, fetching existing order', {
              merchantId,
              awb: ndrData.awb,
              externalOrderId: ndrData.externalOrderId,
            });
            order = await Order.findOne({
              merchantId: merchant._id,
              $or: [{ awb: ndrData.awb }, { externalOrderId: ndrData.externalOrderId }],
            });
            if (order) {
              order.awb = ndrData.awb;
              order.carrier = ndrData.carrier;
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      } else {
        // Update order info
        order.awb = ndrData.awb;
        order.carrier = ndrData.carrier;
      }

      // Update NDR state on order
      order.status = 'ndr_detected';
      
      const isFake = this.detectFakeAttempt(order, ndrData);
      
      order.ndr = {
        reason: ndrData.reason,
        detectedAt: new Date(),
        rescueMessagesSent: 1,
        lastMessageSentAt: new Date(),
        customerResponse: null,
        resolvedAt: null,
        resolution: null,
        isFakeAttempt: isFake,
      };
      await order.save();

      // Classify reason
      const category = this.classifyNDRReason(ndrData.reason);

      // Send WhatsApp template
      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (err) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
      const templateName = `ndr_rescue_${lang}`;

      // Body expects: {{1}} Customer Name, {{2}} Order ID, {{3}} Translated Reason
      const translatedReason = this.translateReason(category, lang);
      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.customerName || 'Customer' },
            { type: 'text', text: order.externalOrderId },
            { type: 'text', text: translatedReason },
          ],
        },
      ];

      // Quick Reply buttons carry payload formatted as: action:orderId
      // e.g., "reschedule:65f8a0...", "address:65f8a0...", "cancel:65f8a0..."
      // Note: Meta allows quick replies payloads up to 256 chars.
      // We will rely on our webhook receiver parsing this action structure.

      await whatsAppService.sendTemplate(
        order.customerPhone,
        templateName,
        lang,
        components,
        {
          phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
          accessToken: waToken,
          businessAccountId: merchant.whatsappConfig?.businessAccountId,
        }
      );

      // Deduct credit atomically
      const updateRes = await Merchant.updateOne(
        { _id: merchant._id, 'billing.rescueCredits': { $gt: 0 } },
        { $inc: { 'billing.rescueCredits': -1 } }
      );
      if (updateRes.modifiedCount === 0) {
        throw new Error('Insufficient credits during deduction');
      }
      await BillingEvent.create({
        merchantId: merchant._id,
        eventType: 'whatsapp_template_sent',
        orderId: order._id,
        creditsCost: 1,
      });

      // Update status
      order.status = 'ndr_rescue_sent';
      await order.save();

      // Schedule escalation reminders
      const chain = merchant.settings.ndrRescue.escalationChain || [4, 12, 24];
      const eq = this.getEscalationQueue();

      for (let i = 0; i < chain.length; i++) {
        const hours = chain[i];
        const delayMs = hours * 60 * 60 * 1000;

        await eq.add(
          'escalate-ndr',
          {
            orderId: order._id.toString(),
            level: i + 1,
            merchantId: merchant._id.toString(),
          },
          {
            delay: delayMs,
            jobId: `escalation:${order._id}:${i + 1}`, // prevent duplicates
            removeOnComplete: true,
            removeOnFail: true,
          }
        );
      }

      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'ndr_rescue_sent',
        source: 'ndr_service',
        payload: { awb: ndrData.awb, category, reason: ndrData.reason },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to process NDR event rescue', { awb: ndrData.awb, error: err.message });
      await AuditLog.create({
        merchantId: new Types.ObjectId(merchantId),
        action: 'ndr_rescue_sent',
        source: 'ndr_service',
        payload: ndrData,
        status: 'failed',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Handle customer response button click
   */
  public async handleCustomerResponse(phone: string, buttonPayload: string): Promise<void> {
    logger.info('Handling customer response', { phone, buttonPayload });

    // Payload format: action:orderId (e.g. reschedule:65f8a0f...)
    const parts = buttonPayload.split(':');
    if (parts.length !== 2) {
      logger.warn('Invalid button payload format', { buttonPayload });
      return;
    }

    const [action, orderId] = parts;

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn('Order not found for customer response', { orderId });
        return;
      }

      if (order.status === 'ndr_rescued' || order.status === 'delivered') {
        logger.info('Order already resolved', { orderId });
        return;
      }

      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${order.merchantId}`);
      }

      // Decrypt carrier API token
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
        email: config.shiprocket.email, // fallback or direct email setup
        password: config.shiprocket.password,
      };

      if (action === 'reschedule') {
        // Reschedule tomorrow
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        logger.info('Rescheduling delivery with carrier', { awb: order.awb, tomorrow });
        
        if (order.carrier && order.awb) {
          const result = await logisticsService.rescheduleDelivery(
            order.carrier,
            {
              awb: order.awb,
              newDate: tomorrow,
              reason: 'Customer requested reattempt tomorrow via WhatsApp',
            },
            carrierConfig
          );

          if (result.success) {
            order.status = 'ndr_rescued';
            if (order.ndr) {
              order.ndr.customerResponse = 'reschedule';
              order.ndr.resolvedAt = new Date();
              order.ndr.resolution = 'rescheduled';
            }
            await order.save();

            // Cancel any pending escalation jobs
            const eq = this.getEscalationQueue();
            const chain = merchant.settings.ndrRescue.escalationChain || [4, 12, 24];
            for (let i = 0; i < chain.length; i++) {
              const jobId = `escalation:${order._id}:${i + 1}`;
              const job = await eq.getJob(jobId);
              if (job) await job.remove();
            }

            // Increment merchant stats
            await Merchant.findByIdAndUpdate(order.merchantId, {
              $inc: { 'billing.totalRescues': 1 },
            });

            // Send confirmation WhatsApp message
            const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
            const rescheduleMsgMap: Record<string, string> = {
              hi: 'धन्यवाद! आपकी डिलीवरी कल के लिए रीशेड्यूल कर दी गई है। 🚚',
              ta: 'நன்றி! உங்கள் டெலிவரி நாளைக்கு மாற்றப்பட்டுள்ளது. 🚚',
              te: 'ధన్యవాదాలు! మీ డెలివరీ రేపటికి మార్చబడింది. 🚚',
              bn: 'ধন্যবাদ! আপনার ডেলিভারি আগামীকালের জন্য পুনর্নির্ধারণ করা হয়েছে। 🚚',
              mr: 'धन्यवाद! तुमची डिलिव्हरी उद्यासाठी रीशेड्यूल केली आहे. 🚚',
              en: 'Thank you! Your delivery has been rescheduled for tomorrow. 🚚',
            };
            const rescheduleMsg = rescheduleMsgMap[lang] || rescheduleMsgMap['en'];

            await whatsAppService.sendInteractiveButtons(
              order.customerPhone,
              rescheduleMsg,
              [], // No further action buttons needed
              {
                phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
                accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
              }
            );
          } else {
            throw new Error(`Carrier reschedule failed: ${result.message}`);
          }
        } else {
          throw new Error('Carrier or AWB information is missing from order record');
        }
      } else if (action === 'address') {
        // Send address update instructions
        if (order.ndr) {
          order.ndr.customerResponse = 'address_update_started';
        }
        await order.save();

        const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
        const instructionsMap: Record<string, string> = {
          hi: 'कृपया इस संदेश के उत्तर में अपना पूरा डिलीवरी पता (पता, शहर, पिनकोड) टाइप करें।',
          ta: 'தயவுசெய்து இந்தச் செய்திக்கு உங்கள் முழுமையான புதுப்பிக்கப்பட்ட டெலிவரி முகவரியைப் பதிலளிக்கவும்.',
          te: 'దయచేసి ఈ మెసేజ్‌కి మీ పూర్తి నవీకరించబడిన డెలివరీ చిరునామాను సమాధానంగా పంపండి.',
          bn: 'আপনার সম্পূর্ণ নতুন ডেলিভারি ঠিকানা লিখে এই মেসেজের উত্তর দিন।',
          mr: 'कृपया या संदेशाला उत्तर देऊन तुमचा पूर्ण नवीन डिलिव्हरी पत्ता पाठवा.',
          en: 'Please reply to this message with your complete updated delivery address, including city and pincode.',
        };
        const instructions = instructionsMap[lang] || instructionsMap['en'];

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          instructions,
          [],
          {
            phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
            accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
          }
        );
      } else if (action === 'cancel') {
        // Mark as canceled
        order.status = 'rto';
        if (order.ndr) {
          order.ndr.customerResponse = 'cancel';
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'cancelled';
        }
        await order.save();

        // Cancel pending escalation jobs
        const eq = this.getEscalationQueue();
        const chain = merchant.settings.ndrRescue.escalationChain || [4, 12, 24];
        for (let i = 0; i < chain.length; i++) {
          const jobId = `escalation:${order._id}:${i + 1}`;
          const job = await eq.getJob(jobId);
          if (job) await job.remove();
        }

        // Send cancel confirmation
        const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
        const cancelMsgMap: Record<string, string> = {
          hi: 'धन्यवाद, आपका ऑर्डर कैंसलेशन अनुरोध दर्ज कर लिया गया है।',
          ta: 'நன்றி, உங்கள் ஆர்டர் ரத்துசெய்தல் கோரிக்கை பதிவு செய்யப்பட்டது.',
          te: 'ధన్యవాదాలు, మీ ఆర్డర్ రద్దు అభ్యర్థన నమోదు చేయబడింది.',
          bn: 'ধন্যবাদ, আপনার অর্ডার বাতিলের অনুরোধ রেকর্ড করা হয়েছে।',
          mr: 'धन्यवाद, तुमची ऑर्डर रद्द करण्याची विनंती नोंदवली गेली आहे.',
          en: 'Thank you, your order cancellation request has been recorded.',
        };
        const cancelMsg = cancelMsgMap[lang] || cancelMsgMap['en'];

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          cancelMsg,
          [],
          {
            phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
            accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
          }
        );
      }

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: `customer_response_${action}`,
        source: 'whatsapp_webhook',
        payload: { buttonPayload, phone },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to handle customer response button click', { phone, error: err.message });
      throw err;
    }
  }

  /**
   * Handle customer location response for NDR address correction
   */
  public async handleCustomerLocationResponse(
    phone: string,
    location: { latitude: number; longitude: number; name?: string; address?: string }
  ): Promise<void> {
    const normalizedPhone = normalizeIndianPhone(phone);
    logger.info('Handling customer location response', { phone: normalizedPhone, location });

    const order = await Order.findOne({
      customerPhone: normalizedPhone,
      status: 'ndr_rescue_sent',
    }).sort({ updatedAt: -1 });

    if (!order) {
      logger.info('Received WhatsApp location message, but no active order found waiting for address update', { phone: normalizedPhone });
      return;
    }

    try {
      const geocodedAddress = await geocodingService.reverseGeocode(location.latitude, location.longitude);

      if (!order.ndr) {
        order.ndr = {
          rescueMessagesSent: 1,
        };
      }
      if (!order.ndr.addressUpdate) {
        order.ndr.addressUpdate = {
          collectionState: 'idle',
        };
      }

      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${order.merchantId}`);
      }

      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (err) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: waToken,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };

      if (order.ndr.addressUpdate.collectionState === 'awaiting_location') {
        order.ndr.addressUpdate.latitude = location.latitude;
        order.ndr.addressUpdate.longitude = location.longitude;
        order.ndr.addressUpdate.geocodedAddress = geocodedAddress;
        order.ndr.addressUpdate.collectionState = 'awaiting_text';
        await order.save();

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          'Location pin locked! 📍 Now please reply with your floor, tower, room number, or landmark to complete your address.',
          [],
          waConfig
        );
      } else {
        order.ndr.addressUpdate.latitude = location.latitude;
        order.ndr.addressUpdate.longitude = location.longitude;
        order.ndr.addressUpdate.geocodedAddress = geocodedAddress;
        order.ndr.addressUpdate.collectionState = 'complete';
        order.status = 'ndr_rescued';
        order.ndr.resolvedAt = new Date();
        order.ndr.resolution = 'address_updated';
        order.ndr.customerResponse = `location_provided: ${geocodedAddress}`;
        await order.save();

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
          email: config.shiprocket.email,
          password: config.shiprocket.password,
        };

        if (order.carrier && order.awb) {
          const pincodeMatch = geocodedAddress.match(/\b\d{6}\b/);
          const pincode = pincodeMatch ? pincodeMatch[0] : '';

          await logisticsService.updateAddress(
            order.carrier,
            {
              awb: order.awb,
              address: geocodedAddress.substring(0, 200),
              city: 'Updated',
              pincode,
              phone: order.customerPhone,
              customerName: order.customerName || 'Customer',
            },
            carrierConfig
          );
        }

        await Merchant.findByIdAndUpdate(order.merchantId, {
          $inc: { 'billing.totalRescues': 1 },
        });

        const eq = this.getEscalationQueue();
        const chain = merchant.settings?.ndrRescue?.escalationChain || [4, 12, 24];
        for (let i = 0; i < chain.length; i++) {
          const jobId = `escalation:${order._id}:${i + 1}`;
          const job = await eq.getJob(jobId);
          if (job) await job.remove();
        }

        const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
        const confirmMsgMap: Record<string, string> = {
          hi: 'धन्यवाद! हमने आपका पता अपडेट कर दिया है और कूरियर को सूचित कर दिया है। 🚚',
          ta: 'நன்றி! கூரியரிடம் உங்கள் முகவரியைப் புதுப்பித்துவிட்டோம். 🚚',
          te: 'ధన్యవాదాలు! మేము కొరియర్‌తో మీ చిరునామాను నవీకరించాము. 🚚',
          bn: 'ধন্যবাদ! আমরা ক্যুরিয়ারের সাথে আপনার ঠিকানা আপডেট করেছি। 🚚',
          mr: 'धन्यवाद! आम्ही कुरिअरकडे तुमचा पत्ता अपडेट केला आहे. 🚚',
          en: 'Thank you! We have updated your address with the courier. 🚚',
        };
        const confirmMsg = confirmMsgMap[lang] || confirmMsgMap['en'];

        await whatsAppService.sendInteractiveButtons(order.customerPhone, confirmMsg, [], waConfig);
      }

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'customer_response_location',
        source: 'whatsapp_webhook',
        payload: { location, geocodedAddress },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to handle customer location response', { phone: normalizedPhone, error: err.message });
      throw err;
    }
  }

  /**
   * Handle text responses (primarily for Address Updates)
   */
  public async handleCustomerTextResponse(phone: string, text: string): Promise<void> {
    const normalizedPhone = normalizeIndianPhone(phone);
    
    // Find active order in address update state
    const order = await Order.findOne({
      customerPhone: normalizedPhone,
      status: 'ndr_rescue_sent',
    }).sort({ updatedAt: -1 });

    if (!order) {
      logger.info('Received WhatsApp text message, but no order is waiting for address update', { phone, text });
      return;
    }

    const isAwaitingText = order.ndr?.addressUpdate?.collectionState === 'awaiting_text';
    const isAddressStarted = order.ndr?.customerResponse === 'address_update_started';

    if (!isAwaitingText && !isAddressStarted) {
      logger.info('Received WhatsApp text message, but order is not waiting for address update', { phone, text });
      return;
    }

    logger.info('Processing customer address update text', { phone: normalizedPhone, text, isAwaitingText });

    try {
      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (err) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: waToken,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };

      let enrichedAddress = text;
      if (isAwaitingText && order.ndr?.addressUpdate?.geocodedAddress) {
        enrichedAddress = `${order.ndr.addressUpdate.geocodedAddress}, ${text}`;
      }

      const pincodeMatch = enrichedAddress.match(/\b\d{6}\b/);
      const pincode = pincodeMatch ? pincodeMatch[0] : '';
      const updatedAddress = enrichedAddress.substring(0, 200);
      const city = 'Updated';

      if (!order.ndr) {
        order.ndr = { rescueMessagesSent: 1 };
      }
      if (!order.ndr.addressUpdate) {
        order.ndr.addressUpdate = {};
      }
      order.ndr.addressUpdate.textAddress = text;
      order.ndr.addressUpdate.collectionState = 'complete';

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
        email: config.shiprocket.email,
        password: config.shiprocket.password,
      };

      if (order.carrier && order.awb) {
        const result = await logisticsService.updateAddress(
          order.carrier,
          {
            awb: order.awb,
            address: updatedAddress,
            city,
            pincode,
            phone: order.customerPhone,
            customerName: order.customerName || 'Customer',
          },
          carrierConfig
        );

        if (result.success) {
          order.status = 'ndr_rescued';
          order.ndr.customerResponse = `address_provided: ${text}`;
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'address_updated';
          await order.save();

          await Merchant.findByIdAndUpdate(order.merchantId, {
            $inc: { 'billing.totalRescues': 1 },
          });

          const eq = this.getEscalationQueue();
          const chain = merchant.settings?.ndrRescue?.escalationChain || [4, 12, 24];
          for (let i = 0; i < chain.length; i++) {
            const jobId = `escalation:${order._id}:${i + 1}`;
            const job = await eq.getJob(jobId);
            if (job) await job.remove();
          }

          const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
          const confirmMsgMap: Record<string, string> = {
            hi: 'धन्यवाद! हमने आपका पता अपडेट कर दिया है और कूरियर को सूचित कर दिया है। 🚚',
            ta: 'நன்றி! கூரியரிடம் உங்கள் முகவரியைப் புதுப்பித்துவிட்டோம். 🚚',
            te: 'ధన్యవాదాలు! మేము కొరియర్‌తో మీ చిరునామాను నవీకరించాము. 🚚',
            bn: 'ধন্যবাদ! আমরা ক্যুরিয়ারের সাথে আপনার ঠিকানা আপডেট করেছি। 🚚',
            mr: 'धन्यवाद! आम्ही कुरिअरकडे तुमचा पत्ता अपडेट केला आहे. 🚚',
            en: 'Thank you! We have updated your address with the courier. 🚚',
          };
          const confirmMsg = confirmMsgMap[lang] || confirmMsgMap['en'];

          await whatsAppService.sendInteractiveButtons(
            order.customerPhone,
            confirmMsg,
            [],
            waConfig
          );
        } else {
          throw new Error(`Carrier address update failed: ${result.message}`);
        }
      }
    } catch (err: any) {
      logger.error('Failed to handle address update text response', { phone: normalizedPhone, error: err.message });
      
      try {
        const order = await Order.findOne({ customerPhone: normalizedPhone, status: 'ndr_rescue_sent' }).sort({ updatedAt: -1 });
        if (order) {
          const merchant = await Merchant.findById(order.merchantId);
          if (merchant) {
            const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);
            const failMsgMap: Record<string, string> = {
              hi: '⚠️ माफ़ कीजिये, कूरियर द्वारा पता अपडेट स्वीकार नहीं किया गया (शायद पिनकोड अमान्य है)। कृपया एक सही 6-अंकीय पिनकोड के साथ अपना पूरा पता दोबारा लिखकर भेजें।',
              ta: '⚠️ மன்னிக்கவும், கூரியரால் முகவரி புதுப்பிப்பு ஏற்கப்படவில்லை. சரியான 6 இலக்க பின்கோடுடன் மீண்டும் அனுப்பவும்.',
              te: '⚠️ క్షమించండి, కొరియర్ చిరునామా నవీకరణను ఆమోదించలేదు. దయచేసి సరైన 6 అంకెల పిన్‌కోడ్‌తో మళ్ళీ పంపండి.',
              bn: '⚠️ দুঃখিত, ক্যুরিয়ার ঠিকানা আপডেট গ্রহণ করেনি। সঠিক ৬-সংখ্যার পিনকোড সহ পুনরায় পাঠান।',
              mr: '⚠️ माफ करा, कुरिअरने पत्ता अपडेट स्वीकारला नाही. कृपया वैध ६-अंकी पिनकोडसह पुन्हा पाठवा.',
              en: '⚠️ Sorry, the address update was not accepted by the courier (invalid pincode). Please reply with your complete address including a valid 6-digit pincode.',
            };
            const failMsg = failMsgMap[lang] || failMsgMap['en'];
              
            await whatsAppService.sendInteractiveButtons(
              phone,
              failMsg,
              [],
              {
                phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
                accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
              }
            );
          }
        }
      } catch (waErr: any) {
        logger.error('Failed to send address failure message back to customer', { error: waErr.message });
      }
      
      throw err;
    }
  }

  /**
   * Process escalation reminders
   */
  public async escalate(orderId: string, level: number): Promise<void> {
    logger.info('Checking NDR escalation status', { orderId, level });

    const order = await Order.findById(orderId);
    if (!order) return;

    // Check if order was already resolved / rescued
    if (order.status === 'ndr_rescued' || order.status === 'delivered' || order.status === 'rto') {
      logger.info('Order already resolved, skipping escalation', { orderId, status: order.status });
      return;
    }

    try {
      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) return;

      const lang = this.getValidLanguage(merchant.settings?.ndrRescue?.messageLanguage);

      if (level <= 2) {
        // Send escalation reminder message (e.g. Level 1 = 4h reminder, Level 2 = 12h urgent)
        const isUrgent = level === 2;

        const urgentMsgMap: Record<string, string> = {
          hi: `⚠️ ज़रूरी: आपका ऑर्डर #${order.externalOrderId} वापस हो जाएगा। डिलीवरी बचाने के लिए अभी नीचे बटन दबाएं!`,
          ta: `⚠️ அவசரம்: உங்கள் ஆர்டர் #${order.externalOrderId} கடைக்குத் திருப்பப்படும். உங்கள் டெலிவரியைச் சேமிக்க கீழே தட்டவும்!`,
          te: `⚠️ అత్యవసరం: మీ ఆర్డర్ #${order.externalOrderId} స్టోర్‌కి తిరిగి పంపబడుతుంది. మీ డెలివరీని కాపాడుకోవడానికి క్రింద నొక్కండి!`,
          bn: `⚠️ জরুরী: আপনার অর্ডার #${order.externalOrderId} ফেরত পাঠানো হবে। আপনার ডেলিভারি বাঁচাতে নিচে ট্যাপ করুন!`,
          mr: `⚠️ तातडीचे: तुमची ऑर्डर #${order.externalOrderId} स्टोअरवर परत केली जाईल. तुमची डिलिव्हरी वाचवण्यासाठी खाली टॅप करा!`,
          en: `⚠️ Urgent: Your order #${order.externalOrderId} will be returned to store. Tap below to save your delivery now!`,
        };

        const reminderMsgMap: Record<string, string> = {
          hi: `रिमाइंडर: हमने आपके ऑर्डर #${order.externalOrderId} को डिलीवर करने की कोशिश की थी। क्या आप कल डिलीवरी चाहते हैं?`,
          ta: `நினைவூட்டல்: உங்கள் ஆர்டர் #${order.externalOrderId} ஐ விநியோகிக்க முயற்சித்தோம். நாளை மீண்டும் முயற்சிக்கவா?`,
          te: `గుర్తుచేసే సందేశం: మేము మీ ఆర్డర్ #${order.externalOrderId} ని డెలివరీ చేయడానికి ప్రయత్నించాము. రేపు మళ్ళీ ప్రయత్నించమంటారా?`,
          bn: `রিমাইন্ডার: আমরা আপনার অর্ডার #${order.externalOrderId} ডেলিভারি করার চেষ্টা করেছি। আপনি কি আগামীকাল পুনরায় চেষ্টা চান?`,
          mr: `स्मरणपत्र: आम्ही तुमची ऑर्डर #${order.externalOrderId} पोहोचवण्याचा प्रयत्न केला. तुम्ही उद्या पुन्हा प्रयत्न करू इच्छिता का?`,
          en: `Reminder: We tried delivering your order #${order.externalOrderId}. Would you like us to reattempt delivery?`,
        };

        const rescheduleBtnMap: Record<string, string> = {
          hi: 'हाँ, कल डिलीवर करें',
          ta: 'ஆமாம், நாளை விநியோகிக்கவும்',
          te: 'అవును, రేపు డెలివరీ చేయండి',
          bn: 'হ্যাঁ, আগামীকাল ডেলিভারি করুন',
          mr: 'होय, उद्या डिलिव्हर करा',
          en: 'Reschedule Tomorrow',
        };

        const addressBtnMap: Record<string, string> = {
          hi: 'पता अपडेट करें',
          ta: 'முகவரியைப் புதுப்பிக்கவும்',
          te: 'చిరునాமா నవీకరించండి',
          bn: 'ঠিকানা আপডেট করুন',
          mr: 'पत्ता अपडेट करा',
          en: 'Update Address',
        };

        const msg = isUrgent ? (urgentMsgMap[lang] || urgentMsgMap['en']) : (reminderMsgMap[lang] || reminderMsgMap['en']);
        const buttons = [
          { id: `reschedule:${order._id}`, title: rescheduleBtnMap[lang] || rescheduleBtnMap['en'] },
          { id: `address:${order._id}`, title: addressBtnMap[lang] || addressBtnMap['en'] },
        ];

        let waToken: string | undefined;
        try {
          if (merchant.whatsappConfig?.accessToken) {
            waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
          }
        } catch (err) {
          waToken = merchant.whatsappConfig?.accessToken;
        }

        await whatsAppService.sendInteractiveButtons(
          order.customerPhone,
          msg,
          buttons,
          {
            phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
            accessToken: waToken,
            businessAccountId: merchant.whatsappConfig?.businessAccountId,
          }
        );

        if (order.ndr) {
          order.ndr.rescueMessagesSent += 1;
          order.ndr.lastMessageSentAt = new Date();
        }
        await order.save();
      } else {
        // Level 3 (e.g. 24h expired) -> Mark unresolved
        order.status = 'rto';
        if (order.ndr) {
          order.ndr.resolvedAt = new Date();
          order.ndr.resolution = 'unresolved';
        }
        await order.save();

        logger.info('NDR escalation limit reached, marking order as unresolvable (RTO)', { orderId });
      }

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: `ndr_escalation_level_${level}`,
        source: 'ndr_service',
        payload: { level },
        status: 'success',
      });
    } catch (err: any) {
      logger.error('Failed to process escalation', { orderId, level, error: err.message });
      throw err;
    }
  }

  /* ----------------- Helper Methods ----------------- */

  public getValidLanguage(lang?: string): string {
    const supported = ['en', 'hi', 'ta', 'te', 'bn', 'mr'];
    if (lang && supported.includes(lang.toLowerCase())) {
      return lang.toLowerCase();
    }
    return 'en';
  }

  public detectFakeAttempt(order: any, ndrData: NDREventData): boolean {
    const now = new Date();
    const hour = now.getHours();

    // 1. Outside normal delivery hours (e.g., before 8 AM or after 10 PM)
    if (hour < 8 || hour >= 22) {
      return true;
    }

    // 2. Suspiciously fast NDR after out-for-delivery
    if (order.outForDeliveryAt) {
      const ofdTime = new Date(order.outForDeliveryAt).getTime();
      const ndrTime = now.getTime();
      const diffMinutes = (ndrTime - ofdTime) / (1000 * 60);

      if (diffMinutes < 15) {
        return true; // Fake attempt if NDR is within 15 minutes of Out for Delivery
      }
    }

    return false;
  }

  public classifyNDRReason(reason: string): 'customer_unavailable' | 'wrong_address' | 'refused' | 'phone_unreachable' | 'other' {
    const r = reason.toLowerCase();
    if (r.includes('unavailable') || r.includes('not available') || r.includes('out of station') || r.includes('not reachable') || r.includes('locked')) {
      return 'customer_unavailable';
    }
    if (r.includes('address') || r.includes('location') || r.includes('landmark') || r.includes('pincode') || r.includes('area')) {
      return 'wrong_address';
    }
    if (r.includes('refused') || r.includes('reject') || r.includes('cancel') || r.includes('not matching') || r.includes('did not order')) {
      return 'refused';
    }
    if (r.includes('switch') || r.includes('busy') || r.includes('network') || r.includes('unreachable') || r.includes('no response') || r.includes('not connecting')) {
      return 'phone_unreachable';
    }
    return 'other';
  }

  private translateReason(category: string, lang: string): string {
    if (lang === 'hi') {
      switch (category) {
        case 'customer_unavailable':
          return 'ग्राहक उपलब्ध नहीं थे';
        case 'wrong_address':
          return 'अधूरा या गलत पता';
        case 'refused':
          return 'ऑर्डर लेने से इनकार कर दिया';
        case 'phone_unreachable':
          return 'फोन नंबर बंद या नेटवर्क से बाहर था';
        default:
          return 'अज्ञात डिलीवरी समस्या';
      }
    }

    if (lang === 'ta') {
      switch (category) {
        case 'customer_unavailable':
          return 'வாடிக்கையாளர் கிடைக்கவில்லை';
        case 'wrong_address':
          return 'தவறான அல்லது அரைகுறை முகவரி';
        case 'refused':
          return 'டெலிவரி நிராகரிக்கப்பட்டது';
        case 'phone_unreachable':
          return 'தொலைபேசி தொடர்புகொள்ள முடியவில்லை';
        default:
          return 'டெலிவரி சிக்கல்';
      }
    }

    if (lang === 'te') {
      switch (category) {
        case 'customer_unavailable':
          return 'వినియోగదారు అందుబాటులో లేరు';
        case 'wrong_address':
          return 'తప్పు లేదా అసంపూర్ణ చిరునామా';
        case 'refused':
          return 'డెలివరీ నిరాకరించబడింది';
        case 'phone_unreachable':
          return 'ఫోన్ కలవడం లేదు';
        default:
          return 'డెలివరీ సమస్య';
      }
    }

    if (lang === 'bn') {
      switch (category) {
        case 'customer_unavailable':
          return 'গ্রাহক উপলব্ধ ছিলেন না';
        case 'wrong_address':
          return 'ভুল বা অসম্পূর্ণ ঠিকানা';
        case 'refused':
          return 'ডেলিভারি প্রত্যাখ্যান করা হয়েছে';
        case 'phone_unreachable':
          return 'ফোন নম্বর যোগাযোগযোগ্য নয়';
        default:
          return 'ডেলিভারি সমস্যা';
      }
    }

    if (lang === 'mr') {
      switch (category) {
        case 'customer_unavailable':
          return 'ग्राहक उपलब्ध नव्हते';
        case 'wrong_address':
          return 'चुकीचा किंवा अपूर्ण पत्ता';
        case 'refused':
          return 'डिलीव्हरी नाकारली';
        case 'phone_unreachable':
          return 'फोन नंबर संपर्क क्षेत्राबाहेर आहे';
        default:
          return 'डिलीव्हरी समस्या';
      }
    }

    // Default English
    switch (category) {
      case 'customer_unavailable':
        return 'Customer Unavailable';
      case 'wrong_address':
        return 'Incorrect Address';
      case 'refused':
        return 'Delivery Refused';
      case 'phone_unreachable':
        return 'Phone Unreachable';
      default:
        return 'Delivery Issue';
    }
  }
}

export const ndrService = NDRService.getInstance();
