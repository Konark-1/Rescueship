import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr, ParsedNdr } from './carrier-ndr.handler';

import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseShiprocketWebhook(req: Request): ParsedNdr | { error: string } {
  const body = req.body ?? {};
  const awb = safeStr(body.awb || body.awb_code, 64);
  const externalOrderId = safeStr(body.order_id || body.external_order_id, 128);
  if (!awb && !externalOrderId) return { error: 'Missing awb or order_id in payload' };

  const rawStatus = safeStr(body.current_status || body.status || body.current_status_id, 64);
  const remark = safeStr(body.ndr_reason || body.remark || body.reason, 256);

  // Check if NDR via path or status mapping
  const isExplicitNdrPath = (req.path || '').includes('/ndr');
  const normalized = normalizeCarrierStatus('shiprocket', rawStatus, remark);
  const isNdr = isExplicitNdrPath || normalized.isNdr;
  const normalizedStatus = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.current_timestamp || body.scans?.[0]?.date;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb: awb || `AWB-${externalOrderId}`,
    externalOrderId: externalOrderId || `ORD-${awb}`,
    reason: remark || (isNdr ? 'Customer not available' : ''),
    phone: safeStr(body.customer_phone || body.phone, 32) || undefined,
    status: normalizedStatus,
    isNdr,
    attemptTime,
    eventId:
      req.get('x-shiprocket-event-id') ||
      req.get('x-event-id') ||
      `${awb}_${normalizedStatus}_${safeStr(body.current_status_id || body.order_id, 64) || 'event'}`,
  };
}

const handler = createCarrierNdrHandler(
  'shiprocket',
  () => process.env.SHIPROCKET_WEBHOOK_SECRET || undefined,
  parseShiprocketWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
