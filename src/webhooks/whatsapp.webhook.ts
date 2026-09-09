import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { whatsAppService } from '../services/whatsapp.service';
import { ndrService } from '../services/ndr.service';
import { addressCorrectionService } from '../services/address-correction.service';
import { rescueMatchingService, MatchCandidate } from '../services/rescue-matching.service';
import { IdempotencyGuard, IdempotencyUnavailableError } from '../utils/idempotency';
import { config } from '../config/env';
import { logger, maskPhone } from '../utils/logger';
import { Merchant } from '../models';
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
 * GET Route: WhatsApp Webhook Verification
 * Meta Cloud API requires a verification step where they send a hub.challenge
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Never log the presented token — it is the shared secret.
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
 * POST Route: Handle incoming WhatsApp message / button clicks
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

  const parsed = whatsAppService.parseIncomingMessage(req.body);
  if (!parsed) {
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  // --- derive merchant from the RECEIVING number (cross-tenant safety) ---
  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = typeof value?.metadata?.phone_number_id === 'string' ? value.metadata.phone_number_id : undefined;
  const merchant = phoneNumberId ? await Merchant.findOne({ 'whatsappConfig.phoneNumberId': phoneNumberId }) : null;

  if (!merchant) {
    logger.warn('Inbound WA for unknown phoneNumberId — no matching merchant, dropping message', { phoneNumberId });
    res.status(200).send('EVENT_RECEIVED');
    return;
  }
  const merchantId = merchant._id.toString();

  // ─── Idempotency (tenant-namespaced, atomic claim) ───
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
      // Let Meta retry rather than silently dropping a customer reply.
      res.status(503).send('RETRY');
      return;
    }
    throw err;
  }

  // Acknowledge receipt to Meta now that the claim is durable (prevents retry loop)
  res.status(200).send('EVENT_RECEIVED');

  try {
    logger.info('Parsed WhatsApp incoming message', { from: maskPhone(parsed.from), type: parsed.type, merchantId });

    // --- resolve the order WITHIN this merchant only ---
    const result = await rescueMatchingService.resolveInbound(merchantId, parsed.from);

    if (result.ambiguous) {
      // Reply from the merchant's own number with the DECRYPTED token (the stored value is ciphertext).
      // Always pass the merchant's config (never `undefined`, which would mean the platform number).
      const waConfig = {
        phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
        accessToken: merchant.whatsappConfig?.accessToken ? encryptionService.decrypt(merchant.whatsappConfig.accessToken) : undefined,
        businessAccountId: merchant.whatsappConfig?.businessAccountId,
      };
      await whatsAppService.sendText(parsed.from, rescueMatchingService.disambiguationMessage(result.candidates!), waConfig);
      await redisConnection.set(`wa_disambig:${merchantId}:${normalizeIndianPhone(parsed.from)}`, JSON.stringify(result.candidates), 'EX', 600);
      return;
    }

    if (!result.matched) {
      // R3 Fix: Read frozen candidates from Redis window snapshot
      const pending = await redisConnection.get(`wa_disambig:${merchantId}:${normalizeIndianPhone(parsed.from)}`);
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
    // Processing failed after ack: release the claim so Meta's retry can be processed.
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
