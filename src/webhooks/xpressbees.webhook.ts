import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseXpressbeesWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(body.awb || body.waybill || body.tracking_number || body.shipment_id, 64);
  if (!awb) return { error: 'Missing awb/waybill in Xpressbees payload' };

  const rawStatus = safeStr(body.status || body.event_name || body.current_status, 64);
  const remarks = safeStr(body.remarks || body.reason || body.ndr_reason || body.comment, 256);

  const normalized = normalizeCarrierStatus('xpressbees', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.status_date || body.timestamp;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(body.order_id || body.order_number || body.external_order_id, 128),
    reason: remarks || (isNdr ? 'Customer unavailable' : ''),
    phone: safeStr(body.phone || body.customer_phone || body.contact, 32) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-xpressbees-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'xpressbees',
  () => process.env.XPRESSBEES_WEBHOOK_SECRET || undefined,
  parseXpressbeesWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
