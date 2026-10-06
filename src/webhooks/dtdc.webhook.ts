import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseDtdcWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(
    body.awb || body.consignment_number || body.awb_no || body.tracking_number || body.cn_no || body.shipment_id,
    64
  );
  if (!awb) return { error: 'Missing awb/consignment number in DTDC payload' };

  const rawStatus = safeStr(body.status || body.event || body.current_status || body.status_type || body.action, 64);
  const remarks = safeStr(body.remarks || body.reason || body.ndr_reason || body.comment || body.action_remarks, 256);

  const normalized = normalizeCarrierStatus('dtdc', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.status_date || body.event_date || body.timestamp;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(body.reference_number || body.order_id || body.order_number || body.ref_id || body.customer_reference_number, 128),
    reason: remarks || (isNdr ? 'Customer unavailable / delivery attempt failed' : ''),
    phone: safeStr(body.phone || body.mobile || body.customer_phone || body.contact, 32) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-dtdc-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'dtdc',
  () => process.env.DTDC_WEBHOOK_SECRET || undefined,
  parseDtdcWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
