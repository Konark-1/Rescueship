/**
 * qr-whatsapp.service.ts
 * ─────────────────────────────────────────────────────────────
 * Bridges Payment QR generation → WhatsApp media dispatch
 * and sends real-time Seller Payment Alerts.
 */

import axios from 'axios';
import FormData from 'form-data';
import { paymentService } from './payment.service';
import { whatsAppService } from './whatsapp.service';
import { encryptionService } from './encryption.service';
import { Merchant, AuditLog } from '../models';
import { logger } from '../utils/logger';

export interface WhatsAppMediaConfig {
  phoneNumberId: string;
  accessToken: string;
}

export class QRWhatsAppService {
  private static instance: QRWhatsAppService;
  private constructor() {}

  public static getInstance(): QRWhatsAppService {
    if (!QRWhatsAppService.instance) {
      QRWhatsAppService.instance = new QRWhatsAppService();
    }
    return QRWhatsAppService.instance;
  }

  /**
   * Generate UPI QR code and send it as a WhatsApp image message.
   * Called during COD conversion flow AFTER payment link is created.
   */
  public async sendQRCodeToCustomer(
    customerPhone: string,
    paymentUrl: string,
    orderId: string,
    orderValue: number,
    discount: number,
    waConfig: WhatsAppMediaConfig
  ): Promise<boolean> {
    try {
      logger.info('Generating UPI QR code for customer', { customerPhone, orderId });

      // Step 1: Generate QR code data URL (base64 PNG)
      const qrDataUrl = await paymentService.generateQRCode(paymentUrl);

      // Step 2: Convert data URL to Buffer for upload
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Step 3: Upload media to WhatsApp Cloud API
      const mediaId = await this.uploadMediaToWhatsApp(imageBuffer, 'image/png', waConfig);

      if (!mediaId) {
        logger.error('Failed to upload QR image to WhatsApp', { orderId });
        return false;
      }

      // Step 4: Send image message with caption
      const caption =
        `📱 *Scan to Pay ₹${orderValue - discount}*\n\n` +
        `Order #${orderId}\n` +
        `💰 You save ₹${discount} by paying online!\n\n` +
        `Scan with PhonePe / Google Pay / Paytm\n` +
        `⏰ Link expires in 24 hours`;

      await this.sendWhatsAppImage(customerPhone, mediaId, caption, waConfig);

      logger.info('UPI QR code sent to customer via WhatsApp', { customerPhone, orderId, mediaId });
      return true;
    } catch (err: any) {
      logger.error('Failed to send QR code to customer', {
        customerPhone,
        orderId,
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Upload media (image) to WhatsApp Cloud API and return media ID.
   */
  private async uploadMediaToWhatsApp(
    imageBuffer: Buffer,
    mimeType: string,
    waConfig: WhatsAppMediaConfig
  ): Promise<string | null> {
    try {
      const url = `https://graph.facebook.com/v22.0/${waConfig.phoneNumberId}/media`;

      const form = new FormData();
      form.append('file', imageBuffer, {
        filename: 'upi_qr.png',
        contentType: mimeType,
      });
      form.append('messaging_product', 'whatsapp');
      form.append('type', mimeType);

      const response = await axios.post(url, form, {
        headers: {
          Authorization: `Bearer ${waConfig.accessToken}`,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return response.data.id;
    } catch (err: any) {
      logger.error('WhatsApp media upload failed', {
        error: err.response?.data || err.message,
      });
      return null;
    }
  }

  /**
   * Send an image message via WhatsApp Cloud API.
   */
  private async sendWhatsAppImage(
    to: string,
    mediaId: string,
    caption: string,
    waConfig: WhatsAppMediaConfig
  ): Promise<void> {
    const url = `https://graph.facebook.com/v22.0/${waConfig.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        id: mediaId,
        caption,
      },
    };

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${waConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send real-time WhatsApp alert to SELLER when COD → Prepaid conversion succeeds.
   * REPLACES the stub in payment.service.ts.
   */
  public async notifySellerPaymentReceived(
    merchantId: string,
    externalOrderId: string,
    amount: number,
    customerName: string
  ): Promise<void> {
    try {
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        logger.warn('Merchant not found for seller notification', { merchantId });
        return;
      }

      const sellerPhone = (merchant as any).contactPhone || (merchant as any).ownerPhone;
      if (!sellerPhone) {
        logger.warn('No seller phone configured for WhatsApp alerts', { merchantId });
        return;
      }

      let waToken: string | undefined;
      try {
        if (merchant.whatsappConfig?.accessToken) {
          waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
        }
      } catch (err) {
        waToken = merchant.whatsappConfig?.accessToken;
      }

      if (!merchant.whatsappConfig?.phoneNumberId || !waToken) {
        logger.warn('WhatsApp not configured for seller alerts', { merchantId });
        return;
      }

      const message =
        `✅ *Payment Received!*\n\n` +
        `📦 Order: #${externalOrderId}\n` +
        `👤 Customer: ${customerName}\n` +
        `💰 Amount: ₹${amount}\n` +
        `💳 Method: UPI (Prepaid)\n\n` +
        `The order has been converted from COD to Prepaid.\n` +
        `Delivery can proceed without cash collection. 🚚`;

      await whatsAppService.sendInteractiveButtons(
        sellerPhone,
        message,
        [],
        {
          phoneNumberId: merchant.whatsappConfig.phoneNumberId,
          accessToken: waToken,
        }
      );

      await AuditLog.create({
        merchantId: merchant._id,
        action: 'seller_payment_alert_sent',
        source: 'qr_whatsapp_service',
        payload: { orderId: externalOrderId, amount, sellerPhone },
        status: 'success',
      });

      logger.info('Seller payment alert sent via WhatsApp', {
        merchantId,
        orderId: externalOrderId,
        sellerPhone,
      });
    } catch (err: any) {
      logger.error('Failed to send seller payment alert', {
        merchantId,
        error: err.message,
      });
      // Non-blocking: don't throw
    }
  }
}

export const qrWhatsAppService = QRWhatsAppService.getInstance();
