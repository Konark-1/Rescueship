import { Order } from '../models';
import { logger } from './logger';

/**
 * Phone-only fallbacks (no order resolved from the merchant's WhatsApp number) must never
 * act on another merchant's order. If the same customer phone has an in-flight order with a
 * different merchant, the reply is ambiguous and is not acted on.
 */
export async function isAmbiguousAcrossMerchants(order: any, phone: string): Promise<boolean> {
  if (!order?.merchantId || typeof (Order as any).exists !== 'function') return false;
  const other = await (Order as any).exists({
    customerPhone: phone,
    status: 'ndr_rescue_sent',
    merchantId: { $ne: order.merchantId },
  });
  if (other) {
    logger.warn('Phone-only reply matches orders of more than one merchant; not acting on it', { orderId: order._id });
    return true;
  }
  return false;
}
