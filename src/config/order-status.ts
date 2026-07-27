/**
 * order-status.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for Order statuses and terminal outcome mapping.
 * Used by Order model, RescueLedger, and Analytics service.
 */

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

/**
 * Map ANY terminal/observed status to a ledger outcome (R2 fix).
 * Single source of truth — add new platform/courier statuses here.
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
      return null; // not yet terminal → reconcile later
  }
}
