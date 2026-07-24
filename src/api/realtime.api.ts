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

const router = Router();

/**
 * GET /api/realtime/stream
 * Establishes a Server-Sent Events connection for the authenticated merchant.
 * The frontend uses EventSource to connect and receive real-time updates.
 */
router.get(
  '/stream',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const merchantId = req.merchant?.merchantId;
    if (!merchantId) {
      res.status(401).json({ error: 'Unauthorized' });
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
