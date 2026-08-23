/**
 * realtime.api.ts
 * ─────────────────────────────────────────────────────────────
 * SSE endpoint for real-time dashboard streaming.
 * GET /api/realtime/stream — establishes SSE connection.
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { realtimeService } from '../services/realtime.service';
import { logger } from '../utils/logger';
import { Merchant } from '../models/Merchant';

const router = Router();

/**
 * GET /api/realtime/stream
 * Establishes a Server-Sent Events connection for the authenticated merchant.
 * Growth+ feature only.
 */
router.get(
  '/stream',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const merchantId = req.merchant?.merchantId;
    if (!merchantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Plan gate: Growth+ only
    const merchant = await Merchant.findById(merchantId);
    const plan = merchant?.billing?.plan || 'starter';
    if (plan === 'starter' || plan === 'free_trial') {
      res.status(403).json({ error: 'Real-time dashboard requires Growth plan or above.' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Register client
    realtimeService.addClient(merchantId, res);

    // LOW-4 fix: 10-minute connection ceiling to prevent resource leak from hanging sockets
    const maxTimeout = setTimeout(() => {
      try {
        res.write(`event: session_timeout\ndata: {"message":"SSE session reached 10m limit. Reconnecting."}\n\n`);
        res.end();
      } catch {}
    }, 10 * 60 * 1000);

    res.on('close', () => {
      clearTimeout(maxTimeout);
    });

    logger.info('SSE stream established', { merchantId });
  }
);

/**
 * GET /api/realtime/status
 * Returns real-time service health (connected clients count).
 */
router.get(
  '/status',
  authenticateToken,
  (_req: AuthenticatedRequest, res: Response): void => {
    res.json({
      service: 'realtime_sse',
      status: 'active',
      connectedClients: realtimeService.getConnectedClientCount(),
      uptime: process.uptime(),
    });
  }
);

export default router;
