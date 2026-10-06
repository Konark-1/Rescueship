import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseCustomWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(
    body.awb ||
      body.waybill ||
      body.tracking_number ||
      body.tracking_id ||
      body.consignment_number ||
      body.shipment_id ||
      body.docket_no ||
      body.lr_no,
    64
  );
  if (!awb) return { error: 'Missing awb or tracking number in custom payload' };

  const rawStatus = safeStr(
    body.status ||
      body.event ||
      body.shipment_status ||
      body.current_status ||
      body.event_type ||
      body.action,
    64
  );
  const remarks = safeStr(
    body.remarks ||
      body.reason ||
      body.ndr_reason ||
      body.comment ||
      body.failure_reason ||
      body.sub_status,
    256
  );

  const normalized = normalizeCarrierStatus('custom', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.status_date || body.event_date || body.timestamp || body.date;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(
      body.order_id ||
        body.external_order_id ||
        body.order_number ||
        body.reference_number ||
        body.client_order_id,
      128
    ),
    reason: remarks || (isNdr ? 'Delivery attempt failed / NDR event' : ''),
    phone: safeStr(
      body.phone ||
        body.customer_phone ||
        body.mobile ||
        body.recipient_phone ||
        body.contact,
      32
    ) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-custom-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'custom',
  () => process.env.CUSTOM_WEBHOOK_SECRET || undefined,
  parseCustomWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
