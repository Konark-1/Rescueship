import { Router, Request } from 'express';
import { createCarrierNdrHandler, safeStr } from './carrier-ndr.handler';

const router = Router();

router.post(
  '/ndr',
  createCarrierNdrHandler(
    'clickpost',
    () => process.env.CLICKPOST_WEBHOOK_SECRET || undefined,
    (req: Request) => {
      const body = req.body ?? {};
      const awb = safeStr(body.waybill || body.awb, 64);
      if (!awb) return { error: 'Missing waybill/awb in payload' };
      // ClickPost pushes a normalised status code + description (9 = FailedDelivery).
      const code = Number(body.clickpost_status_code ?? body.status?.clickpost_status_code);
      const desc = safeStr(body.clickpost_status_description || body.status?.clickpost_status_description || (typeof body.status === 'string' ? body.status : ''), 64).toLowerCase();
      const isNdr =
        code === 9 ||
        desc.includes('failed') ||
        desc.includes('undelivered') ||
        desc.includes('ndr') ||
        body.is_failed_attempt === true;
      const tsRaw = body.timestamp || body.status?.timestamp || body.created_at;
      const ts = tsRaw ? new Date(tsRaw) : undefined;
      const attemptTime = ts && !Number.isNaN(ts.getTime()) ? ts : undefined;
      const carrierMeta: Record<string, string | number> = {};
      if (body.cp_id !== undefined) carrierMeta.cpId = Number(body.cp_id);
      if (body.account_code) carrierMeta.accountCode = safeStr(body.account_code, 64);
      return {
        awb,
        externalOrderId: safeStr(body.order_id || body.reference_number, 128),
        reason: safeStr(body.remark || body.remarks || body.reason || body.additional?.ndr_reason, 256) || 'Failed Delivery Attempt',
        phone: safeStr(body.customer_phone || body.phone, 32) || undefined,
        status: isNdr ? 'UNDELIVERED' : (desc || 'unknown').toUpperCase(),
        isNdr,
        attemptTime,
        carrierMeta,
        // Per-scan id so attempt 2 on the same AWB is not deduped as a retry of attempt 1.
        eventId: req.get('x-clickpost-event-id') || req.get('x-event-id') || `${awb}_${Number.isFinite(code) ? code : desc || 'ndr'}_${safeStr(String(tsRaw || ''), 40) || 'notime'}`,
      };
    }
  )
);

export default router;
