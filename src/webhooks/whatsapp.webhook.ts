import { Router, Request, Response } from 'express';
import { whatsAppService } from '../services/whatsapp.service';
import { ndrService } from '../services/ndr.service';
import { config } from '../config/env';
import { logger } from '../utils/logger';

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

    logger.info('Parsed WhatsApp incoming message', { from: parsed.from, type: parsed.type });

    if (parsed.type === 'button' && parsed.buttonPayload) {
      // Process button action
      await ndrService.handleCustomerResponse(parsed.from, parsed.buttonPayload);
    } else if (parsed.type === 'text' && parsed.text) {
      // Process text reply (could be address update)
      await ndrService.handleCustomerTextResponse(parsed.from, parsed.text);
    }
  } catch (err: any) {
    logger.error('Error handling incoming WhatsApp webhook event', { error: err.message });
  }
});

export default router;
