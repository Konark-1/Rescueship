import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseEcomexpressWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(body.awb || body.airwaybill_number || body.airwaybill || body.waybill || body.tracking_number, 64);
  if (!awb) return { error: 'Missing awb/airwaybill in Ecom Express payload' };

  const rawStatus = safeStr(body.status || body.reason_code || body.status_type || body.scan_type || body.event, 64);
  const remarks = safeStr(body.remarks || body.reason || body.ndr_reason || body.reason_description || body.comment, 256);

  const normalized = normalizeCarrierStatus('ecomexpress', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.status_date || body.scan_date_time || body.timestamp;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(body.order_id || body.order_number || body.reference_number || body.ref_id, 128),
    reason: remarks || (isNdr ? 'Customer unavailable / delivery attempt failed' : ''),
    phone: safeStr(body.phone || body.mobile || body.customer_phone || body.contact, 32) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-ecomexpress-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'ecomexpress',
  () => process.env.ECOMEXPRESS_WEBHOOK_SECRET || undefined,
  parseEcomexpressWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
