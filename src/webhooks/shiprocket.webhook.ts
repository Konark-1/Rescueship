import { Router, Request } from 'express';
import { config } from '../config/env';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';

const router = Router();

router.post(
  '/ndr',
  createCarrierNdrHandler(
    'shiprocket',
    () => process.env.SHIPROCKET_WEBHOOK_SECRET || config.shiprocket.password || undefined,
    (req: Request) => {
      const body = req.body ?? {};
      const awb = safeStr(body.awb, 64);
      const externalOrderId = safeStr(body.order_id, 128);
      if (!awb || !externalOrderId) return { error: 'Missing awb or order_id in payload' };
      return {
        awb,
        externalOrderId,
        reason: safeStr(body.ndr_reason || body.reason, 256) || 'Customer Unavailable',
        phone: safeStr(body.customer_phone || body.phone, 32) || undefined,
        status: safeStr(body.current_status || body.current_status_id, 64),
        isNdr: true, // Shiprocket's dedicated NDR webhook only fires for failed attempts
        eventId: req.get('x-shiprocket-event-id') || req.get('x-event-id') || `${awb}_${safeStr(body.current_status_id || body.order_id, 64) || 'ndr'}`,
      };
    }
  )
);

export default router;
