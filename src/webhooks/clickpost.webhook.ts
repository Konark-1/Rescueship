import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';

const router = Router();

router.post(
  '/ndr',
  createCarrierNdrHandler(
    'clickpost',
    () => process.env.CLICKPOST_WEBHOOK_SECRET || undefined,
    (req: Request) => {
      const body = req.body ?? {};
      const awb = safeStr(body.waybill || body.awb, 64);
      if (!awb) return { error: 'Missing waybill/awb in payload' };
      const status = safeStr(body.status, 64).toLowerCase();
      const isNdr =
        status.includes('failed') ||
        status.includes('undelivered') ||
        status.includes('ndr') ||
        body.is_failed_attempt === true;
      return {
        awb,
        externalOrderId: safeStr(body.order_id, 128),
        reason: safeStr(body.remarks || body.reason, 256) || 'Failed Delivery Attempt',
        phone: safeStr(body.customer_phone || body.phone, 32) || undefined,
        status,
        isNdr,
        eventId: req.get('x-clickpost-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}`,
      };
    }
  )
);

export default router;
