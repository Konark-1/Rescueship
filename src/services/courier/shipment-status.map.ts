/**
 * shipment-status.map.ts
 * Enterprise Carrier Status Normalization Map.
 *
 * Normalizes carrier-specific status IDs and raw string labels from Shiprocket,
 * ClickPost, and Delhivery into canonical RescueShip InternalShipmentStatus.
 */

import { InternalShipmentStatus } from '../../models/Shipment';

export interface NormalizedCarrierResult {
  normalizedStatus: InternalShipmentStatus;
  isNdr: boolean;
  isTerminal: boolean;
}

/**
 * Official Shiprocket Status Codes & Labels:
 * 6  - SHIPPED (In Transit)
 * 7  - DELIVERED
 * 8  - CANCELED
 * 9  - RTO INITIATED / UNDELIVERED (NDR)
 * 13 - RTO INITIATED
 * 14 - RTO DELIVERED (Returned)
 * 17 - OUT FOR DELIVERY
 * 18 - IN TRANSIT (Multiple attempt)
 * 19 - OUT FOR PICKUP
 * 42 - PICKUP EXCEPTION
 * 67 - FULFILLMENT ERROR / LOST
 */
export const SHIPROCKET_STATUS_MAP: Record<string, { status: InternalShipmentStatus; isNdr: boolean }> = {
  // Numeric IDs
  '1': { status: 'awb_generated', isNdr: false },
  '6': { status: 'in_transit', isNdr: false },
  '7': { status: 'delivered', isNdr: false },
  '8': { status: 'cancelled', isNdr: false },
  '9': { status: 'ndr_detected', isNdr: true },
  '13': { status: 'rto_initiated', isNdr: false },
  '14': { status: 'returned', isNdr: false },
  '17': { status: 'out_for_delivery', isNdr: false },
  '18': { status: 'in_transit', isNdr: false },
  '19': { status: 'picked_up', isNdr: false },
  '42': { status: 'in_transit', isNdr: false },
  '67': { status: 'lost', isNdr: false },

  // Standard String Labels
  AWB_ASSIGNED: { status: 'awb_generated', isNdr: false },
  LABEL_GENERATED: { status: 'awb_generated', isNdr: false },
  PICKED_UP: { status: 'picked_up', isNdr: false },
  IN_TRANSIT: { status: 'in_transit', isNdr: false },
  SHIPPED: { status: 'in_transit', isNdr: false },
  OUT_FOR_DELIVERY: { status: 'out_for_delivery', isNdr: false },
  UNDELIVERED: { status: 'ndr_detected', isNdr: true },
  NDR: { status: 'ndr_detected', isNdr: true },
  DELIVERY_FAILED: { status: 'ndr_detected', isNdr: true },
  DELIVERED: { status: 'delivered', isNdr: false },
  RTO_INITIATED: { status: 'rto_initiated', isNdr: false },
  RTO_IN_TRANSIT: { status: 'rto_initiated', isNdr: false },
  RTO_DELIVERED: { status: 'returned', isNdr: false },
  RETURNED: { status: 'returned', isNdr: false },
  CANCELED: { status: 'cancelled', isNdr: false },
  CANCELLED: { status: 'cancelled', isNdr: false },
  LOST: { status: 'lost', isNdr: false },
  DAMAGED: { status: 'lost', isNdr: false },
};

/**
 * ClickPost Normalized Status Maps
 */
export const CLICKPOST_STATUS_MAP: Record<string, { status: InternalShipmentStatus; isNdr: boolean }> = {
  ORDER_PLACED: { status: 'awb_generated', isNdr: false },
  MANIFESTED: { status: 'awb_generated', isNdr: false },
  PICKED_UP: { status: 'picked_up', isNdr: false },
  IN_TRANSIT: { status: 'in_transit', isNdr: false },
  OUT_FOR_DELIVERY: { status: 'out_for_delivery', isNdr: false },
  FAILED_ATTEMPT: { status: 'ndr_detected', isNdr: true },
  UNDELIVERED: { status: 'ndr_detected', isNdr: true },
  DELIVERED: { status: 'delivered', isNdr: false },
  RTO: { status: 'rto_initiated', isNdr: false },
  RETURN_TO_ORIGIN: { status: 'rto_initiated', isNdr: false },
  RETURN_DELIVERED: { status: 'returned', isNdr: false },
  CANCELLED: { status: 'cancelled', isNdr: false },
  LOST: { status: 'lost', isNdr: false },
};

/**
 * Delhivery Unified Status Maps
 */
export const DELHIVERY_STATUS_MAP: Record<string, { status: InternalShipmentStatus; isNdr: boolean }> = {
  MANIFEST: { status: 'awb_generated', isNdr: false },
  IN_TRANSIT: { status: 'in_transit', isNdr: false },
  DISPATCHED: { status: 'out_for_delivery', isNdr: false },
  PENDING: { status: 'ndr_detected', isNdr: true },
  UNDELIVERED: { status: 'ndr_detected', isNdr: true },
  DELIVERED: { status: 'delivered', isNdr: false },
  RTO: { status: 'rto_initiated', isNdr: false },
  RETURN: { status: 'returned', isNdr: false },
  CANCELLED: { status: 'cancelled', isNdr: false },
  CLOSED: { status: 'lost', isNdr: false },
};

const TERMINAL_SET = new Set<InternalShipmentStatus>(['delivered', 'returned', 'cancelled', 'lost']);

/**
 * Normalize any carrier status string or numeric code to canonical status
 */
export function normalizeCarrierStatus(
  carrier: 'shiprocket' | 'clickpost' | 'delhivery' | string,
  rawStatus: string | number | undefined,
  remark?: string
): NormalizedCarrierResult {
  if (!rawStatus) {
    return {
      normalizedStatus: remark ? 'ndr_detected' : 'in_transit',
      isNdr: Boolean(remark),
      isTerminal: false,
    };
  }

  const cleanKey = String(rawStatus).trim().toUpperCase().replace(/\s+/g, '_');
  let match: { status: InternalShipmentStatus; isNdr: boolean } | undefined;

  switch (carrier.toLowerCase()) {
    case 'shiprocket':
      match = SHIPROCKET_STATUS_MAP[cleanKey];
      break;
    case 'clickpost':
      match = CLICKPOST_STATUS_MAP[cleanKey];
      break;
    case 'delhivery':
      match = DELHIVERY_STATUS_MAP[cleanKey];
      break;
    default:
      match = SHIPROCKET_STATUS_MAP[cleanKey];
  }

  if (match) {
    return {
      normalizedStatus: match.status,
      isNdr: match.isNdr,
      isTerminal: TERMINAL_SET.has(match.status),
    };
  }

  // Heuristic fallbacks for unknown or custom carrier strings
  if (cleanKey.includes('UNDELIVERED') || cleanKey.includes('FAILED') || cleanKey.includes('NDR')) {
    return { normalizedStatus: 'ndr_detected', isNdr: true, isTerminal: false };
  }
  if (cleanKey.includes('OUT_FOR_DELIVERY')) {
    return { normalizedStatus: 'out_for_delivery', isNdr: false, isTerminal: false };
  }
  if (cleanKey.includes('DELIVERED')) {
    return { normalizedStatus: 'delivered', isNdr: false, isTerminal: true };
  }
  if (cleanKey.includes('RTO_INITIATED') || cleanKey === 'RTO') {
    return { normalizedStatus: 'rto_initiated', isNdr: false, isTerminal: false };
  }
  if (cleanKey.includes('RETURNED') || cleanKey.includes('RTO_DELIVERED')) {
    return { normalizedStatus: 'returned', isNdr: false, isTerminal: true };
  }
  if (cleanKey.includes('CANCEL')) {
    return { normalizedStatus: 'cancelled', isNdr: false, isTerminal: true };
  }

  return {
    normalizedStatus: remark ? 'ndr_detected' : 'in_transit',
    isNdr: Boolean(remark),
    isTerminal: false,
  };
}
