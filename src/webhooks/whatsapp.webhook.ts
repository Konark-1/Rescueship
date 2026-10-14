import { Router, Request, Response } from 'express';
import { markWebhookSeen } from '../utils/webhook-heartbeat';
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

const OPT_OUT_RE = /^(please\s+)?(stop|unsubscribe|opt[\s-]?out|stop\s+messag(e|ing)(\s+me)?|do\s*n'?o?t\s+message(\s+me)?|band\s+karo)[\s.!]*$/i;
const OPT_IN_RE = /^(start|subscribe|unstop|resume)[\s.!]*$/i;
export const isOptOutMessage = (text: string): boolean => OPT_OUT_RE.test(String(text || '').trim());
export const isOptInMessage = (text: string): boolean => OPT_IN_RE.test(String(text || '').trim());

function safeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
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
 * GET Route: WhatsApp / Meta Webhook Verification Handshake
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken =
    process.env.META_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    config.whatsapp?.verifyToken;

  logger.info('Received WhatsApp webhook verification request', { mode, tokenPresent: typeof token === 'string' && token.length > 0 });

  if (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    typeof expectedToken === 'string' &&
    expectedToken.length > 0 &&
    safeEqualStr(token, expectedToken)
  ) {
    logger.info('WhatsApp webhook verified successfully');
    markWebhookSeen('WHATSAPP_VERIFY');
    res.status(200).send(typeof challenge === 'string' ? challenge : '');
  } else {
    logger.warn('WhatsApp webhook verification failed', { mode, tokenPresent: typeof token === 'string' && token.length > 0 });
    res.sendStatus(403);
  }
});

/**
 * POST Route: Handle incoming WhatsApp messages, button clicks, and delivery status updates
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Hub-Signature-256');
  const rawBody = (req as any).rawBody;

  // Verify signature. Candidates: the platform Meta app secret, plus the secret of the
  // merchant's own Meta app when they connected manually with their app. The payload's
  // phone_number_id only selects which secret to try; nothing is trusted before a match.
  const secrets: string[] = [];
  if (config.whatsapp.appSecret) secrets.push(config.whatsapp.appSecret);
  const claimedPhoneId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  if (typeof claimedPhoneId === 'string' && /^\d{5,32}$/.test(claimedPhoneId)) {
    try {
      const owner: any = await Merchant.findOne({ 'whatsappConfig.phoneNumberId': claimedPhoneId }).select('whatsappConfig.appSecret');
      const enc = owner?.whatsappConfig?.appSecret;
      if (enc) secrets.push(encryptionService.decrypt(enc));
    } catch (err: any) {
      logger.warn('Could not load merchant app secret for WhatsApp webhook', { error: err?.message });
    }
  }

  if (secrets.length) {
    if (!signature || !rawBody) {
      logger.warn('WhatsApp webhook rejected: missing signature header or body', { hasSignature: !!signature, hasBody: !!rawBody });
      res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
      return;
    }
    const isValid = secrets.some((sec) => whatsAppService.verifyWebhookSignature(rawBody, signature, sec));
    if (!isValid) {
      logger.warn('WhatsApp webhook signature verification failed');
      res.status(401).json({ error: 'Invalid WhatsApp signature' });
      return;
    }
    markWebhookSeen('WHATSAPP');
  } else if (process.env.WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS === 'true' && process.env.NODE_ENV !== 'production') {
    logger.warn('WhatsApp appSecret not configured — accepting UNSIGNED webhook (WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS=true, local dev only)');
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

    // Owner phone verification: the merchant sends "RescueShip verify 123456" from their own
    // phone to their business number. Never treated as a customer reply.
    if ((merchant as any).ownerPhoneVerification?.phone) {
      const { tryVerifyOwnerPhone } = await import('../services/free-test.service');
      if (await tryVerifyOwnerPhone(merchant, normalizedFrom, parsed.text || '')) return;
    }

    // Opt-out / opt-in: whole-message keywords only (an address like "near bus stop"
    // must never unsubscribe anyone), scoped to THIS merchant.
    const customerReply = (parsed.text || '').trim();
    if (isOptOutMessage(customerReply)) {
      try {
        const { SuppressedPhone } = await import('../models/SuppressedPhone');
        await SuppressedPhone.findOneAndUpdate(
          { phone: normalizedFrom, merchantId: merchant._id },
          { phone: normalizedFrom, merchantId: merchant._id, suppressedAt: new Date(), reason: 'customer_opt_out' },
          { upsert: true, new: true }
        );
        logger.info('Customer opted out via WhatsApp reply — suppressed for this merchant', { from: maskPhone(normalizedFrom), merchantId });
      } catch (optErr: any) {
        logger.error('Failed to record customer opt-out', { error: optErr?.message });
      }
      return;
    }
    if (isOptInMessage(customerReply)) {
      try {
        const { SuppressedPhone } = await import('../models/SuppressedPhone');
        await SuppressedPhone.deleteMany({ phone: normalizedFrom, merchantId: merchant._id });
        logger.info('Customer opted back in via WhatsApp reply', { from: maskPhone(normalizedFrom), merchantId });
      } catch (optErr: any) {
        logger.error('Failed to record customer opt-in', { error: optErr?.message });
      }
      return;
    }

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
    const fromCandidates = [normalizedFrom, `+${normalizedFrom}`, normalizedFrom.slice(-10)];
    const activeCase = await NdrCase.findOne({
      merchantId: merchant._id,
      customerPhone: { $in: fromCandidates },
      status: { $in: ['OPEN', 'WAITING_CUSTOMER', 'CUSTOMER_RESPONDED', 'ADDRESS_RECEIVED', 'LOCATION_RECEIVED', 'REATTEMPT_REQUESTED'] },
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
      // Only treat as closed if there are truly no active orders in flight
      const hasActiveOrder = await Order.exists({
        merchantId: merchant._id,
        customerPhone: { $in: fromCandidates },
        status: { $in: ['ndr_rescue_sent', 'ndr_detected', 'ndr_rescued', 'cod_conversion_sent', 'awaiting_deposit', 'awaiting_prepaid_conversion', 'out_for_delivery', 'shipped'] },
      });

      if (!hasActiveOrder) {
        const closedOrder = await Order.findOne({
          merchantId: merchant._id,
          customerPhone: { $in: fromCandidates },
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
    let resolvedOrder: any = null;

    if (parsed.type === 'button' && parsed.buttonPayload) {
      const parsedBtn = ndrService.parseButtonPayload(parsed.buttonPayload);
      if (parsedBtn?.orderId) {
        try {
          resolvedOrder = await Order.findOne({
            $or: [{ _id: parsedBtn.orderId }, { externalOrderId: parsedBtn.orderId }],
            merchantId: merchant._id,
          });
          if (resolvedOrder) {
            logger.info('Resolved order directly from button payload', { orderId: resolvedOrder._id, buttonPayload: parsed.buttonPayload });
          }
        } catch {
          // Fall back to heuristic phone matching
        }
      }
    }

    if (!resolvedOrder) {
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

      resolvedOrder = result.order;
    }

    await dispatchOrder(resolvedOrder, parsed);
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
