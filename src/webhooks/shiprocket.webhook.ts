import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr, ParsedNdr } from './carrier-ndr.handler';

import { normalizeCarrierStatus, SHIPROCKET_STATUS_MAP } from '../services/courier/shipment-status.map';

const router = Router();

export function parseShiprocketWebhook(req: Request): ParsedNdr | { error: string } {
  const root = req.body ?? {};
  // Shiprocket v2 wraps payload in a nested `data` object
  const body = root.data && typeof root.data === 'object' ? root.data : root;

  const awb = safeStr(body.awb_code || body.awb, 64);
  const externalOrderId = safeStr(body.order_id || body.external_order_id, 128);
  if (!awb && !externalOrderId) return { error: 'Missing awb or order_id in payload' };

  const statusLabel = safeStr(body.current_status || body.shipment_status || body.status, 64);
  const statusId = safeStr(body.current_status_id ?? body.shipment_status_id, 16);
  const remark = safeStr(body.ndr_reason || body.remark || body.reason, 256);

  // Classify by Shiprocket's status code / label only. The URL path (/ndr vs /tracking)
  // says nothing about the event: Shiprocket posts every tracking update to one URL.
  const byId = statusId ? normalizeCarrierStatus('shiprocket', statusId) : null;
  const byLabel = statusLabel ? normalizeCarrierStatus('shiprocket', statusLabel) : null;
  // Prefer the human label (unambiguous); fall back to the numeric id only when no known label.
  const labelKnown = Boolean(statusLabel && SHIPROCKET_STATUS_MAP[statusLabel.trim().toUpperCase().replace(/\s+/g, '_')]);
  const idKnown = Boolean(statusId && SHIPROCKET_STATUS_MAP[String(statusId).trim()]);
  const known = labelKnown ? byLabel : idKnown ? byId : null;
  const isNdr = known ? known.isNdr : (!statusId && !statusLabel && Boolean(body.ndr_reason));
  const normalizedStatus = isNdr ? 'UNDELIVERED' : (known?.normalizedStatus || statusLabel || 'UNKNOWN').toUpperCase();

  // Attempt time = the latest scan's time when present (never the ETD).
  const lastScan = Array.isArray(body.scans) && body.scans.length ? body.scans[body.scans.length - 1] : null;
  const attemptTimeRaw = body.attempt_time || lastScan?.date || body.current_timestamp;
  const parsedTime = attemptTimeRaw ? new Date(attemptTimeRaw) : undefined;
  const attemptTime = parsedTime && !Number.isNaN(parsedTime.getTime()) ? parsedTime : undefined;

  if (!awb) return { error: 'Missing AWB in payload' };

  return {
    awb,
    externalOrderId,
    reason: remark || (isNdr ? 'Customer not available' : ''),
    phone: safeStr(body.customer_phone || body.phone, 32) || undefined,
    status: normalizedStatus,
    isNdr,
    attemptTime,
    // No provider event id: make each scan distinct (status + its timestamp) so a second
    // failed attempt on the same AWB is not mistaken for a retry of the first.
    eventId:
      req.get('x-shiprocket-event-id') ||
      req.get('x-event-id') ||
      `${awb}_${normalizedStatus}_${statusId || 'na'}_${safeStr(String(attemptTimeRaw || ''), 40) || 'notime'}`,
  };
}

const handler = createCarrierNdrHandler(
  'shiprocket',
  () => process.env.SHIPROCKET_WEBHOOK_SECRET || undefined,
  parseShiprocketWebhook
);

router.post(['/', '/ndr', '/tracking'], handler);

export default router;
