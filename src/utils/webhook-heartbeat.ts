/**
 * Records "a correctly signed webhook from <source> reached us" so the operator's
 * setup report can tell configured integrations from unconfigured ones.
 * Best-effort: never throws, never blocks the webhook response for long.
 */
import mongoose from 'mongoose';

export type HeartbeatSource = 'WHATSAPP' | 'WHATSAPP_VERIFY' | 'RAZORPAY' | 'PAYMENT' | 'SHOPIFY' | 'SHIPROCKET' | 'CARRIER';

const COLLECTION = 'ops_webhook_heartbeats';

export function markWebhookSeen(source: HeartbeatSource | string): void {
  try {
    const db = mongoose.connection?.db;
    if (!db || mongoose.connection.readyState !== 1) return;
    void db
      .collection(COLLECTION)
      .updateOne({ _id: String(source).toUpperCase() as any }, { $set: { at: new Date() }, $inc: { count: 1 } }, { upsert: true })
      .catch(() => undefined);
  } catch {
    /* best-effort */
  }
}

export async function lastWebhookSeen(source: string): Promise<Date | null> {
  try {
    const db = mongoose.connection?.db;
    if (!db) return null;
    const doc: any = await db.collection(COLLECTION).findOne({ _id: String(source).toUpperCase() as any });
    return doc?.at ? new Date(doc.at) : null;
  } catch {
    return null;
  }
}
