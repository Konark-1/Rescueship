import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { whatsAppService } from '../services/whatsapp.service';
import { ndrService } from '../services/ndr.service';
import { addressCorrectionService } from '../services/address-correction.service';
import { rescueMatchingService, MatchCandidate } from '../services/rescue-matching.service';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { config } from '../config/env';
import { logger, maskPhone } from '../utils/logger';
import { Merchant, MessageLog, NdrCase, Order } from '../models';
import { encryptionService } from '../services/encryption.service';
import { normalizeIndianPhone } from '../utils/phoneNormalizer';
import { redisConnection } from '../config/redis';

const router = Router();

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

/**
 * Extract latitude and longitude from Google Maps URLs or direct coordinate strings
 */
export function extractGoogleMapsCoordinates(text: string): { latitude: number; longitude: number } | null {
  if (!text) return null;
  const coordRegex = /(?:@|q=|ll=|place\/|destination=)(-?\d+\.\d+),\s*(-?\d+\.\d+)/i;
  const match = text.match(coordRegex);
  if (match && match[1] && match[2]) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

/**
 * GET Route: WhatsApp Webhook Verification
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('Received WhatsApp webhook verification request', { mode, tokenPresent: typeof token === 'string' && token.length > 0 });

  if (mode === 'subscribe' && typeof token === 'string' && safeEqualStr(token, config.whatsapp.verifyToken)) {
    logger.info('WhatsApp webhook verified successfully');
    res.status(200).send(typeof challenge === 'string' ? challenge : '');
  } else {
    logger.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST Route: Handle incoming WhatsApp messages, button clicks, and delivery status updates
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Hub-Signature-256');
  const rawBody = (req as any).rawBody;

  // Verify Signature — MANDATORY
  if (config.whatsapp.appSecret) {
    if (!signature || !rawBody) {
      logger.warn('WhatsApp webhook rejected: missing signature header or body', { hasSignature: !!signature, hasBody: !!rawBody });
      res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
      return;
    }
    const isValid = whatsAppService.verifyWebhookSignature(rawBody, signature, config.whatsapp.appSecret);
    if (!isValid) {
      logger.warn('WhatsApp webhook signature verification failed');
      res.status(401).json({ error: 'Invalid WhatsApp signature' });
      return;
    }
  } else {
    logger.warn('WhatsApp appSecret not configured — rejecting webhook. Set WHATSAPP_APP_SECRET.');
    res.status(401).json({ error: 'WhatsApp webhook secret not configured' });
    return;
  }

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;

  // ─── 1. Meta Delivery Status Callbacks (sent -> delivered -> read | failed) ───
  if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
    for (const statusObj of value.statuses) {
      const { id: metaMessageId, status, timestamp, errors } = statusObj;
      logger.info('Processing WhatsApp message status update', { metaMessageId, status });
      try {
        const updateData: any = { metaStatus: status };
        const tsDate = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
        if (status === 'delivered') updateData.deliveredAt = tsDate;
        if (status === 'read') updateData.readAt = tsDate;
        if (status === 'failed') updateData.error = errors?.[0]?.message || 'Message delivery failed';

        await MessageLog.findOneAndUpdate(
          { metaMessageId },
          { $set: updateData }
        );
      } catch (statusErr: any) {
        logger.warn('Failed to update MessageLog for status callback', { metaMessageId, error: statusErr?.message });
      }
    }
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  // ─── 2. Parse Incoming Message ───
  const parsed = whatsAppService.parseIncomingMessage(req.body);
  if (!parsed) {
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  const phoneNumberId = typeof value?.metadata?.phone_number_id === 'string' ? value.metadata.phone_number_id : undefined;
  const merchant = phoneNumberId ? await Merchant.findOne({ 'whatsappConfig.phoneNumberId': phoneNumberId }) : null;

  if (!merchant) {
    logger.warn('Inbound WA for unknown phoneNumberId — no matching merchant, dropping message', { phoneNumberId });
    res.status(200).send('EVENT_RECEIVED');
    return;
  }
  const merchantId = merchant._id.toString();

  // ─── 3. Deduplication via metaMessageId (wamid) ───
  if (parsed.messageId) {
    const existingLog = await MessageLog.findOne({ metaMessageId: parsed.messageId });
    if (existingLog) {
      logger.info('Duplicate inbound WhatsApp message skipped', { messageId: parsed.messageId });
      res.status(200).send('EVENT_ALREADY_PROCESSED');
      return;
    }
  }

  // ─── 4. Idempotency (tenant-namespaced, atomic claim) ───
  const messageId = parsed.messageId || `${parsed.from}:${parsed.timestamp}:${parsed.type}`;
  const idempotencyKey = IdempotencyGuard.key('whatsapp', merchantId, messageId);
  try {
    const claim = await IdempotencyGuard.claim(idempotencyKey, 3600);
    if (claim === 'duplicate') {
      logger.info('Duplicate WhatsApp incoming message skipped', { messageId, from: maskPhone(parsed.from) });
      res.status(200).send('EVENT_RECEIVED');
      return;
    }
  } catch (err) {
    if (err instanceof IdempotencyUnavailableError) {
      res.status(503).send('RETRY');
      return;
    }
    throw err;
  }

  // Acknowledge receipt to Meta
  res.status(200).send('EVENT_RECEIVED');

  try {
    const normalizedFrom = normalizeIndianPhone(parsed.from);
    logger.info('Parsed WhatsApp incoming message', { from: maskPhone(normalizedFrom), type: parsed.type, merchantId });

    // ─── 4b. Inbound Rate Limiting (Anti-DoS & AI Cost Drain Protection: max 10/hour) ───
    const rateLimitKey = `inbound_wa_limit:${merchantId}:${normalizedFrom}`;
    try {
      const inboundCount = await redisConnection.incr(rateLimitKey);
      if (inboundCount === 1) {
        await redisConnection.expire(rateLimitKey, 3600); // 1-hour window
      }
      if (inboundCount > 10) {
        logger.warn('Inbound WhatsApp rate limit exceeded for customer phone — dropping message to prevent AI cost drain', {
          merchantId,
          from: maskPhone(normalizedFrom),
          inboundCount,
        });
        return;
      }
    } catch (rlErr: any) {
      logger.warn('Redis error during inbound WhatsApp rate limit check', { error: rlErr?.message });
    }

    // ─── 5. Check Active NdrCase or Orphan / Closed Case ───
    const activeCase = await NdrCase.findOne({
      merchantId: merchant._id,
      customerPhone: normalizedFrom,
      status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED'] },
    }).sort({ createdAt: -1 });

    // Save inbound message log
    await MessageLog.create({
      merchantId: merchant._id,
      orderId: activeCase?.orderId || null,
      customerPhone: normalizedFrom,
      direction: 'INBOUND',
      messageType: parsed.type === 'button' ? 'button' : parsed.type === 'location' ? 'location' : parsed.type === 'text' ? 'text' : 'unsupported',
      metaMessageId: parsed.messageId,
      body: parsed.text || parsed.buttonPayload || (parsed.location ? `${parsed.location.latitude},${parsed.location.longitude}` : undefined),
      status: 'delivered',
      isOrphan: !activeCase,
    });

    if (!activeCase) {
      // Check if there is an already resolved / closed order for this customer
      const closedOrder = await Order.findOne({
        merchantId: merchant._id,
        customerPhone: normalizedFrom,
        status: { $in: ['delivered', 'rto', 'returned', 'cancelled'] },
      }).sort({ updatedAt: -1 });

      if (closedOrder) {
        logger.info('Customer replied after order/case already closed — storing reply without automated action', {
          orderId: closedOrder._id,
          status: closedOrder.status,
        });
        return;
      }
    }

    // ─── 6. Handle Unsupported Media Types (audio, video, sticker) ───
    if (parsed.type === 'other') {
      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };
      await whatsAppService.sendText(
        parsed.from,
        'Please reply with text or share your location pin so we can update your delivery with the courier.',
        waConfig
      );
      return;
    }

    // ─── 7. Resolve Order and Dispatch ───
    const result = await rescueMatchingService.resolveInbound(merchantId, parsed.from);

    if (result.ambiguous) {
      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };
      await whatsAppService.sendText(parsed.from, rescueMatchingService.disambiguationMessage(result.candidates!), waConfig);
      await redisConnection.set(`wa_disambig:${merchantId}:${normalizedFrom}`, JSON.stringify(result.candidates), 'EX', 600);
      return;
    }

    if (!result.matched) {
      const pending = await redisConnection.get(`wa_disambig:${merchantId}:${normalizedFrom}`);
      if (pending && /^\d+$/.test((parsed.text || '').trim())) {
        const frozen = JSON.parse(pending) as MatchCandidate[];
        const r2 = await rescueMatchingService.resolveByReference(merchantId, parsed.from, parsed.text!.trim(), frozen);
        if (r2.matched) {
          await dispatchOrder(r2.order, parsed);
          return;
        }
      }
      return;
    }

    await dispatchOrder(result.order, parsed);
  } catch (err: any) {
    logger.error('Error handling incoming WhatsApp webhook event', { error: err.message, merchantId });
    await IdempotencyGuard.release(idempotencyKey);
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
    // Check if text message contains a Google Maps URL / coordinates
    const mapCoords = extractGoogleMapsCoordinates(parsed.text);
    if (mapCoords) {
      logger.info('Extracted Google Maps coordinates from text message', { mapCoords, phone: maskPhone(parsed.from) });
      await addressCorrectionService.handleLocationResponse(parsed.from, {
        latitude: mapCoords.latitude,
        longitude: mapCoords.longitude,
      }, order);
      return;
    }

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
