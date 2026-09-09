import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { AuditLog, BillingEvent, Merchant } from '../models';
import { subscriptionService, isTier, isCycle } from '../services/subscription.service';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/billing/usage
router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const events = await BillingEvent.find({ merchantId }).sort({ timestamp: -1 }).limit(500);
    res.status(200).json(events);
  } catch (err: any) {
    logger.error('Failed to fetch billing usage', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing usage' });
  }
});

// GET /api/billing/plan
router.get('/plan', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const merchant = await Merchant.findById(merchantId).select('billing').lean();
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    // Do not expose provider order/subscription identifiers to the browser.
    const { introOrderId, razorpaySubscriptionId, ...safeBilling } = (merchant as any).billing || {};
    res.status(200).json(safeBilling);
  } catch (err: any) {
    logger.error('Failed to fetch billing plan', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing plan' });
  }
});

// POST /api/billing/checkout  { tier, cycle } → { orderId, subscriptionId, amountInr, currency, keyId }
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { tier, cycle } = req.body ?? {};
  if (!isTier(tier) || !isCycle(cycle)) {
    return res.status(400).json({ error: 'Invalid plan or billing cycle' });
  }
  try { res.json(await subscriptionService.createCheckout(req.merchant!.merchantId, tier, cycle)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// POST /api/billing/checkout/verify  { razorpay_payment_id, razorpay_order_id, razorpay_signature } → active status
// tier/cycle are derived server-side from the pending checkout; client values are only cross-checked.
router.post('/checkout/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const merchantId = req.merchant!.merchantId;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, tier, cycle } = req.body ?? {};
  try {
    const result = await subscriptionService.verifyAndProvision(merchantId, {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      tier: isTier(tier) ? tier : undefined,
      cycle: isCycle(cycle) ? cycle : undefined,
    });

    await BillingEvent.create({ merchantId, eventType: 'subscription_upgraded', creditsCost: 0 });
    await AuditLog.create({
      merchantId,
      action: 'subscription_upgraded',
      source: 'billing_api',
      payload: { plan: result.plan, cycle: result.cycle, orderId: razorpay_order_id, paymentId: razorpay_payment_id },
      status: 'success',
    });

    res.json(result);
  } catch (e: any) {
    logger.warn('Checkout verification failed', { merchantId, error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// GET /api/billing/status → { active, plan, cycle, limit, renewMonthly, activatedAt, nextInvoice }
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await subscriptionService.status(req.merchant!.merchantId)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;
