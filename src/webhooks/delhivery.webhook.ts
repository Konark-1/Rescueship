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
      const rawRiderPhone = safeStr(
        body.fe_phone ||
        body.field_executive_phone ||
        body.rider_phone ||
        body.agent_phone ||
        body.driver_phone ||
        body.delivery_person_phone,
        32
      ) || undefined;
      const rawRiderName = safeStr(
        body.fe_name ||
        body.rider_name ||
        body.field_executive_name,
        64
      ) || undefined;

      return {
        awb,
        externalOrderId: safeStr(body.ref_id || body.order_id, 128),
        reason: remarks,
        phone: safeStr(body.phone || body.customer_phone, 32) || undefined,
        status,
        isNdr,
        assignedRider: rawRiderPhone ? { phone: rawRiderPhone, name: rawRiderName } : undefined,
        eventId: req.get('x-delhivery-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}`,
      };
    }
  )
);

export default router;
