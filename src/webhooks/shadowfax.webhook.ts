import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseShadowfaxWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(body.awb || body.awb_number || body.waybill, 64);
  if (!awb) return { error: 'Missing awb/waybill in Shadowfax payload' };

  const rawStatus = safeStr(body.status || body.current_status || body.scan_type, 64);
  const remarks = safeStr(body.remarks || body.reason || body.failure_reason, 256);

  const normalized = normalizeCarrierStatus('shadowfax', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.updated_at || body.timestamp;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(body.client_order_id || body.order_id || body.order_number, 128),
    reason: remarks || (isNdr ? 'Customer unavailable / delivery incomplete' : ''),
    phone: safeStr(body.phone || body.contact_number || body.customer_phone, 32) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-shadowfax-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'shadowfax',
  () => process.env.SHADOWFAX_WEBHOOK_SECRET || undefined,
  parseShadowfaxWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
