import { Router, Request, Response } from 'express';
import { whatsAppService } from '../services/whatsapp.service';
import { ndrService } from '../services/ndr.service';
import { addressCorrectionService } from '../services/address-correction.service';
import { rescueMatchingService } from '../services/rescue-matching.service';
import { IdempotencyGuard } from '../utils/idempotency';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { Merchant } from '../models';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { redisConnection } from '../config/redis';

const router = Router();

/**
 * GET Route: WhatsApp Webhook Verification
 * Meta Cloud API requires a verification step where they send a hub.challenge
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('Received WhatsApp webhook verification request', { mode, token });

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST Route: Handle incoming WhatsApp message / button clicks
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Hub-Signature-256');
  const rawBody = (req as any).rawBody;

  // Verify Signature
  if (config.whatsapp.appSecret && signature && rawBody) {
    const isValid = whatsAppService.verifyWebhookSignature(rawBody, signature, config.whatsapp.appSecret);
    if (!isValid) {
      logger.warn('WhatsApp webhook signature verification failed');
      res.status(401).json({ error: 'Invalid WhatsApp signature' });
      return;
    }
  }

  // Acknowledge receipt to Meta immediately (prevents retry loop)
  res.status(200).send('EVENT_RECEIVED');

  try {
    const parsed = whatsAppService.parseIncomingMessage(req.body);
    if (!parsed) return;

    // ─── Idempotency: Prevent double-processing of customer replies ───
    const messageId = parsed.messageId || `${parsed.from}:${parsed.timestamp}:${parsed.type}`;
    const idempotencyKey = `wa_incoming:${messageId}`;

    const isDuplicate = await IdempotencyGuard.isProcessed(idempotencyKey);
    if (isDuplicate) {
      logger.info('Duplicate WhatsApp incoming message skipped', { messageId, from: parsed.from });
      return;
    }
    await IdempotencyGuard.markProcessed(idempotencyKey, 3600); // 1 hour TTL
    // ─── END Idempotency ───

    logger.info('Parsed WhatsApp incoming message', { from: parsed.from, type: parsed.type });

    // --- derive merchant from the RECEIVING number (cross-tenant safety) ---
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    let merchant = phoneNumberId ? await Merchant.findOne({ 'whatsappConfig.phoneNumberId': phoneNumberId }) : null;
    
    // Fallback if single merchant or development
    if (!merchant) {
      const merchants = await Merchant.find().limit(2);
      if (merchants.length === 1) {
        merchant = merchants[0];
      } else {
        logger.warn('Inbound WA for unknown phoneNumberId — drop', { phoneNumberId });
        return;
      }
    }
    const merchantId = merchant._id.toString();

    // --- resolve the order WITHIN this merchant only ---
    const result = await rescueMatchingService.resolveInbound(merchantId, parsed.from);

    if (result.ambiguous) {
      const waConfig = merchant.whatsappConfig?.accessToken ? merchant.whatsappConfig : undefined;
      await whatsAppService.sendText(parsed.from, rescueMatchingService.disambiguationMessage(result.candidates!), waConfig);
      await redisConnection.set(`wa_disambig:${merchantId}:${normalizeIndianPhone(parsed.from)}`, JSON.stringify(result.candidates), 'EX', 600);
      return;
    }

    if (!result.matched) {
      // maybe a disambiguation reply (a number) — try reference resolve
      const pending = await redisConnection.get(`wa_disambig:${merchantId}:${normalizeIndianPhone(parsed.from)}`);
      if (pending && /^\d+$/.test((parsed.text || '').trim())) {
        const r2 = await rescueMatchingService.resolveByReference(merchantId, parsed.from, parsed.text!.trim());
        if (r2.matched) {
          await dispatchOrder(r2.order, parsed);
          return;
        }
      }
      return;
    }

    await dispatchOrder(result.order, parsed);
  } catch (err: any) {
    logger.error('Error handling incoming WhatsApp webhook event', { error: err.message });
  }
});

async function dispatchOrder(order: any, parsed: any): Promise<void> {
  if (parsed.type === 'button' && parsed.buttonPayload) {
    await ndrService.handleCustomerResponse(parsed.from, parsed.buttonPayload, order);
  } else if (parsed.type === 'location' && parsed.location) {
    await addressCorrectionService.handleLocationResponse(parsed.from, {
      latitude: parsed.location.latitude,
      longitude: parsed.location.longitude,
      name: parsed.location.name,
      address: parsed.location.address,
    }, order);
  } else if (parsed.type === 'text' && parsed.text) {
    const handled = await addressCorrectionService.handleTextAddressResponse(
      parsed.from,
      parsed.text,
      order
    );
    if (!handled) {
      await ndrService.handleCustomerTextResponse(parsed.from, parsed.text, order);
    }
  }
}

export default router;
