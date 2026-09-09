import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';

const router = Router();

router.post(
  '/ndr',
  createCarrierNdrHandler(
    'delhivery',
    () => process.env.DELHIVERY_WEBHOOK_SECRET || undefined,
    (req: Request) => {
      const body = req.body ?? {};
      const awb = safeStr(body.waybill || body.awb, 64);
      if (!awb) return { error: 'Missing waybill in payload' };
      const status = safeStr(body.status, 64).toLowerCase();
      const remarks = safeStr(body.remarks || body.reason, 256) || 'Undelivered';
      const remarksLc = remarks.toLowerCase();
      const isNdr =
        status.includes('ud') ||
        status.includes('undelivered') ||
        status.includes('failed') ||
        remarksLc.includes('not delivered') ||
        remarksLc.includes('address not found');
      return {
        awb,
        externalOrderId: safeStr(body.ref_id || body.order_id, 128),
        reason: remarks,
        phone: safeStr(body.phone || body.customer_phone, 32) || undefined,
        status,
        isNdr,
        eventId: req.get('x-delhivery-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}`,
      };
    }
  )
);

export default router;
