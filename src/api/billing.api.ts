import { Router, Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { AuditLog, BillingEvent, Merchant } from '../models';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/billing/usage
router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const events = await BillingEvent.find({ merchantId }).sort({ timestamp: -1 });
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
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    res.status(200).json(merchant.billing);
  } catch (err: any) {
    logger.error('Failed to fetch billing plan', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing plan' });
  }
});

// POST /api/billing/create-subscription
router.post('/create-subscription', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const { plan, cycle } = req.body;

  const validPlans = ['starter', 'growth', 'scale'];
  const validCycles = ['quarterly', 'semi_annual', 'annual'];

  if (!validPlans.includes(plan) || !validCycles.includes(cycle)) {
    res.status(400).json({ error: 'Invalid plan or billing cycle' });
    return;
  }

  const PLAN_MONTHLY_PRICES: Record<string, Record<string, number>> = {
    starter: { quarterly: 1599, semi_annual: 1359, annual: 1119 },
    growth: { quarterly: 3999, semi_annual: 3399, annual: 2799 },
    scale: { quarterly: 9999, semi_annual: 8499, annual: 6999 },
  };

  const cycleMonths: Record<string, number> = {
    quarterly: 3,
    semi_annual: 6,
    annual: 12,
  };

  const monthlyPrice = PLAN_MONTHLY_PRICES[plan][cycle];
  const months = cycleMonths[cycle];
  const amount = monthlyPrice * months; // total in INR

  const keyId = config.razorpay.keyId || 'rzp_test_dummykey';
  const keySecret = config.razorpay.keySecret;

  let subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (keyId && keySecret) {
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: amount * 100, // in paise
          currency: 'INR',
          receipt: `sub_${merchantId}_${Date.now()}`,
          notes: {
            merchantId: merchantId?.toString(),
            plan,
            cycle,
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.data && response.data.id) {
        subscriptionId = response.data.id;
      }
    } catch (err: any) {
      logger.warn('Razorpay subscription order creation call failed, using generated ID', { error: err.message });
    }
  }

  logger.info('Created subscription checkout details', { merchantId, plan, cycle, amount, subscriptionId });

  res.status(200).json({
    subscriptionId,
    keyId,
    amount,
    plan,
    cycle,
  });
});

// POST /api/billing/confirm-subscription
router.post('/confirm-subscription', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const { plan, cycle, subscriptionId, paymentId } = req.body;

  try {
    const planLimits: Record<string, number> = {
      starter: 2000,
      growth: 10000,
      scale: 50000,
    };
    const orderLimit = planLimits[plan] || 2000;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    merchant.billing.plan = plan;
    merchant.billing.planOrderLimit = orderLimit;
    if (cycle) {
      merchant.billing.billingCycle = cycle;
    }
    await merchant.save();

    await BillingEvent.create({
      merchantId: merchant._id,
      eventType: 'subscription_upgraded',
      creditsCost: 0,
    });

    await AuditLog.create({
      merchantId: merchant._id,
      action: 'subscription_upgraded',
      source: 'billing_api',
      payload: { plan, cycle, subscriptionId, paymentId },
      status: 'success',
    });

    res.status(200).json({ success: true, billing: merchant.billing });
  } catch (err: any) {
    logger.error('Failed to confirm subscription', { error: err.message });
    res.status(500).json({ error: 'Failed to confirm subscription' });
  }
});

import { subscriptionService } from '../services/subscription.service';

// POST /api/billing/checkout  { tier, cycle } → { orderId, subscriptionId, amountInr, currency, keyId }
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await subscriptionService.createCheckout(req.merchant!.merchantId, req.body.tier, req.body.cycle)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// POST /api/billing/checkout/verify  { razorpay_* , tier, cycle } → active status
router.post('/checkout/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await subscriptionService.verifyAndProvision(req.merchant!.merchantId, req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// GET /api/billing/status → { active, plan, cycle, limit, renewMonthly, activatedAt, nextInvoice }
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await subscriptionService.status(req.merchant!.merchantId)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;
