import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';
import { normalizeCarrierStatus } from '../services/courier/shipment-status.map';

const router = Router();

export function parseBluedartWebhook(req: Request) {
  const body = req.body ?? {};
  const awb = safeStr(body.awb || body.waybill || body.WaybillNo || body.AirwayBillNo, 64);
  if (!awb) return { error: 'Missing waybill/awb in Blue Dart payload' };

  const rawStatus = safeStr(body.status || body.ScanType || body.StatusType || body.scan, 64);
  const remarks = safeStr(body.remarks || body.reason || body.ExceptionRemarks || body.Remarks, 256);

  const normalized = normalizeCarrierStatus('bluedart', rawStatus, remarks);
  const isNdr = (req.path || '').includes('/ndr') || normalized.isNdr;
  const status = isNdr ? 'UNDELIVERED' : normalized.normalizedStatus.toUpperCase();

  const attemptTimeRaw = body.attempt_time || body.ScanDateTime || body.Date;
  const attemptTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;

  return {
    awb,
    externalOrderId: safeStr(body.order_id || body.ref_id || body.OrderNo || body.ReferenceNo, 128),
    reason: remarks || (isNdr ? 'Customer unavailable / delivery attempt failed' : ''),
    phone: safeStr(body.phone || body.customer_phone || body.MobileNo || body.TelNo, 32) || undefined,
    status,
    isNdr,
    attemptTime,
    eventId: req.get('x-bluedart-event-id') || req.get('x-event-id') || `${awb}_${status || 'ndr'}_${Date.now()}`,
  };
}

const handler = createCarrierNdrHandler(
  'bluedart',
  () => process.env.BLUEDART_WEBHOOK_SECRET || undefined,
  parseBluedartWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
