/**
 * order-status.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for Order statuses and terminal outcome mapping.
 * Used by Order model, RescueLedger, and Analytics service.
 */

import { logger } from '../utils/logger';

export const ORDER_STATUS = {
  PENDING: 'pending',
  NEW: 'new',
  SHIPPED: 'shipped',
  NDR_DETECTED: 'ndr_detected',
  NDR_RESCUE_SENT: 'ndr_rescue_sent',
  COD_CONVERSION_SENT: 'cod_conversion_sent',
  NDR_PENDING_REVIEW: 'ndr_pending_review',
  NDR_RESCUED: 'ndr_rescued',
  CONVERTED_PREPAID: 'converted_to_prepaid',
  RTO: 'rto',
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
  OUT_FOR_DELIVERY: 'out_for_delivery',
} as const;

export type NaturalOutcome = 'delivered' | 'rto' | 'cancelled' | 'converted_prepaid' | null;

const KNOWN_NON_TERMINAL = new Set([
  'pending',
  'new',
  'shipped',
  'ndr_rescue_sent',
  'cod_conversion_sent',
  'ndr_pending_review',
  'ndr_detected',
]);

/**
 * Map ANY terminal/observed status to a ledger outcome (R2 fix).
 * Emits a warning if an unknown status is encountered (R4 fix).
 */
export function terminalOutcome(status: string): NaturalOutcome {
  switch (status) {
    case ORDER_STATUS.DELIVERED:
    case ORDER_STATUS.NDR_RESCUED:        // rescued + later delivered both count as delivered win
    case ORDER_STATUS.OUT_FOR_DELIVERY:   // when platform sync updates to out for delivery / delivered
      return 'delivered';
    case ORDER_STATUS.CONVERTED_PREPAID:
      return 'converted_prepaid';
    case ORDER_STATUS.RTO:
      return 'rto';
    case ORDER_STATUS.CANCELLED:
      return 'cancelled';
    default:
      if (status && !KNOWN_NON_TERMINAL.has(status)) {
        logger.warn('terminalOutcome: unrecognized status — add it to order-status.ts if terminal', { status });
      }
      return null; // not yet terminal → reconcile later
  }
}
