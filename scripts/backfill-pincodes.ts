/**
 * backfill-pincodes.ts
 * ─────────────────────────────────────────────────────────────
 * Enterprise Idempotent Backfill Script.
 *
 * Scans historical Orders lacking `shippingPincode`, `shippingCity`, or `shippingState`,
 * inspects embedded `shippingAddress` payloads and historical `WebhookEvent` records,
 * extracts canonical postal and regional telemetry, and safely backfills `Order` documents.
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-pincodes.ts [--dry-run] [--merchant-id=<id>]
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env';
import { Order, WebhookEvent } from '../src/models';
import { logger } from '../src/utils/logger';

export interface BackfillResult {
  totalScanned: number;
  backfilledCount: number;
  alreadyCompleteCount: number;
  unmatchedCount: number;
  dryRun: boolean;
}

export interface BackfillOptions {
  merchantId?: string;
  dryRun?: boolean;
  batchSize?: number;
}

/**
 * Extracts pincode, city, and state from an arbitrary raw payload or address object.
 */
function extractLocationFromPayload(payload: any): { pincode?: string; city?: string; state?: string } {
  if (!payload || typeof payload !== 'object') return {};

  const addr = payload.shipping_address || payload.shipping || payload.billing_address || payload.billing || payload;

  const rawPin = addr.zip || addr.postcode || addr.pincode || addr.postal_code ||
    payload.delivery_pincode || payload.destination_pincode || payload.pickup_pincode;
  const rawCity = addr.city || payload.destination_city || payload.city;
  const rawState = addr.province || addr.state || payload.destination_state || payload.state;

  const cleanPin = rawPin ? String(rawPin).trim().replace(/\D/g, '') : undefined;
  const cleanCity = rawCity && typeof rawCity === 'string' ? rawCity.trim() : undefined;
  const cleanState = rawState && typeof rawState === 'string' ? rawState.trim() : undefined;

  return {
    pincode: cleanPin && cleanPin.length >= 5 ? cleanPin : undefined,
    city: cleanCity && cleanCity.length > 0 ? cleanCity : undefined,
    state: cleanState && cleanState.length > 0 ? cleanState : undefined,
  };
}

/**
 * Runs the idempotent backfill.
 */
export async function backfillPincodes(options: BackfillOptions = {}): Promise<BackfillResult> {
  const { merchantId, dryRun = false, batchSize = 200 } = options;

  logger.info('Starting pincode & location backfill job', { merchantId: merchantId || 'ALL', dryRun, batchSize });

  const filter: any = {
    $or: [
      { shippingPincode: null },
      { shippingPincode: '' },
      { shippingPincode: { $exists: false } },
      { shippingCity: null },
      { shippingCity: { $exists: false } },
    ],
  };

  if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
    filter.merchantId = new mongoose.Types.ObjectId(merchantId);
  }

  const cursor = Order.find(filter).cursor({ batchSize });

  let totalScanned = 0;
  let backfilledCount = 0;
  let alreadyCompleteCount = 0;
  let unmatchedCount = 0;

  for await (const order of cursor) {
    totalScanned++;

    // 1. Try embedded shippingAddress first
    let loc = extractLocationFromPayload(order.shippingAddress);

    // 2. If missing, look up corresponding WebhookEvent rawPayload
    if (!loc.pincode) {
      const webhookQuery: any = { merchantId: order.merchantId };
      const lookupClauses: any[] = [];

      if (order.externalOrderId) {
        lookupClauses.push({ 'rawPayload.id': Number(order.externalOrderId) || order.externalOrderId });
        lookupClauses.push({ 'rawPayload.order_id': order.externalOrderId });
        lookupClauses.push({ 'rawPayload.external_order_id': order.externalOrderId });
      }
      if (order.awb) {
        lookupClauses.push({ 'rawPayload.awb': order.awb });
        lookupClauses.push({ 'rawPayload.awb_code': order.awb });
      }

      if (lookupClauses.length > 0) {
        webhookQuery.$or = lookupClauses;
        const matchingEvent = await WebhookEvent.findOne(webhookQuery).sort({ createdAt: -1 });
        if (matchingEvent && matchingEvent.rawPayload) {
          loc = extractLocationFromPayload(matchingEvent.rawPayload);
        }
      }
    }

    const updates: any = {};
    if (loc.pincode && !order.shippingPincode) updates.shippingPincode = loc.pincode;
    if (loc.city && !order.shippingCity) updates.shippingCity = loc.city;
    if (loc.state && !order.shippingState) updates.shippingState = loc.state;

    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        await Order.updateOne({ _id: order._id }, { $set: updates });
      }
      backfilledCount++;
    } else if (order.shippingPincode && order.shippingCity) {
      alreadyCompleteCount++;
    } else {
      unmatchedCount++;
    }
  }

  const result: BackfillResult = {
    totalScanned,
    backfilledCount,
    alreadyCompleteCount,
    unmatchedCount,
    dryRun,
  };

  logger.info('Pincode & location backfill complete', result);
  return result;
}

// Standalone execution entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const merchantArg = args.find((a) => a.startsWith('--merchant-id='));
  const targetMerchantId = merchantArg ? merchantArg.split('=')[1] : undefined;

  (async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(config.mongodb.uri);
        logger.info('Connected to MongoDB for pincode backfill');
      }

      const res = await backfillPincodes({
        dryRun: isDryRun,
        merchantId: targetMerchantId,
      });

      console.table(res);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err: any) {
      logger.error('Backfill script failed', { error: err.message, stack: err.stack });
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    }
  })();
}
