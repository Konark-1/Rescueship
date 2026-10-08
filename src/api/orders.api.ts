import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { requireFeature } from '../middleware/planGating.middleware';
import { Order, AuditLog, MessageLog, Merchant } from '../models';
import { whatsAppDispatcherService } from '../services/whatsapp/whatsapp-dispatcher.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/orders/export/csv & GET /api/orders/export
 * Export merchant orders in CSV format
 */
const exportOrdersCsv = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;

  try {
    logger.info('Exporting orders CSV', { merchantId });

    const orders = await Order.find({ merchantId }).sort({ createdAt: -1 });

    const headers = [
      'Order ID',
      'Platform',
      'Customer Phone',
      'Customer Name',
      'Order Value',
      'Payment Method',
      'Status',
      'AWB',
      'Carrier',
      'Created At',
    ];

    const escapeCsvField = (field: any): string => {
      if (field === null || field === undefined) return '""';
      let str = String(field);
      // Prevent CSV / DDE injection (matches formula triggers even if preceded by whitespace, tabs, or zero-width chars)
      if (/^[\s\u0000-\u001f\u007f-\u009f\u200B-\u200D\uFEFF]*[=@+\-\t\r|%]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = [headers.join(',')];

    for (const order of orders) {
      const row = [
        escapeCsvField(order.externalOrderId),
        escapeCsvField(order.platform),
        escapeCsvField(order.customerPhone),
        escapeCsvField(order.customerName || ''),
        escapeCsvField(order.orderValue),
        escapeCsvField(order.paymentMethod),
        escapeCsvField(order.status),
        escapeCsvField(order.awb || ''),
        escapeCsvField(order.carrier || ''),
        escapeCsvField(order.createdAt ? order.createdAt.toISOString() : ''),
      ];
      csvRows.push(row.join(','));
    }

    const csvData = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=rescueship_orders.csv');
    res.status(200).send(csvData);
  } catch (err: any) {
    logger.error('Failed to export orders CSV', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to export orders' });
  }
};

router.get('/export/csv', authenticateToken, requireFeature('csv_export'), exportOrdersCsv);
router.get('/export', authenticateToken, requireFeature('csv_export'), exportOrdersCsv);


/**
 * GET /api/orders
 * List orders with pagination and filters
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 200);
  const skip = (page - 1) * limit;

  // STRICT TYPE COERCION & VALIDATION
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const carrier = typeof req.query.carrier === 'string' ? req.query.carrier.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

  const query: any = { merchantId };

  // Whitelist allowed statuses to prevent NoSQL operator injection
  const ALLOWED_STATUSES = [
    'new',
    'cod_conversion_sent',
    'converted_to_prepaid',
    'shipped',
    'ndr_detected',
    'ndr_rescue_sent',
    'ndr_pending_review',
    'ndr_rescued',
    'out_for_delivery',
    'delivered',
    'rto_initiated',
    'rto',
    'returned',
    'cancelled',
  ];
  if (status && ALLOWED_STATUSES.includes(status)) {
    query.status = status;
  }

  const ALLOWED_CARRIERS = ['shiprocket', 'delhivery', 'clickpost'];
  if (carrier && ALLOWED_CARRIERS.includes(carrier)) {
    query.carrier = carrier;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { externalOrderId: { $regex: escapedSearch, $options: 'i' } },
      { customerPhone: { $regex: escapedSearch, $options: 'i' } },
      { customerName: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate && !isNaN(Date.parse(startDate))) query.createdAt.$gte = new Date(startDate);
    if (endDate && !isNaN(Date.parse(endDate))) query.createdAt.$lte = new Date(endDate);
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
  }

  const riskLevel = typeof req.query.riskLevel === 'string' ? req.query.riskLevel.trim().toUpperCase() : '';
  if (['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel)) {
    query['rtoRisk.level'] = riskLevel;
  }

  try {
    logger.info('Fetching orders list', { merchantId, page, limit, query });

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    const merchantDoc = await Merchant.findById(merchantId).select('metaTierLimit');
    const metaTierLimit = merchantDoc?.metaTierLimit ?? 1000;
    const tierCheck = await whatsAppDispatcherService.checkMetaTierLimit(merchantId, metaTierLimit);
    const metaTier = {
      metaTierLimit: tierCheck.limit,
      current24hCount: tierCheck.current,
      isLimitReached: !tierCheck.allowed,
    };

    res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      metaTier,
    });
  } catch (err: any) {
    logger.error('Failed to list orders', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

/**
 * GET /api/orders/chats/recent
 * Retrieve recent customer WhatsApp conversations for dispute and chat auditing
 */
router.get('/chats/recent', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const recentLogs = await MessageLog.find({ merchantId })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    const orderIds = Array.from(new Set(recentLogs.map((l: any) => l.orderId?.toString()).filter(Boolean)));
    const orders = await Order.find({ _id: { $in: orderIds }, merchantId }).lean();
    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));

    const threads: any[] = [];
    const seenOrders = new Set<string>();

    for (const log of recentLogs) {
      const oid = log.orderId?.toString();
      if (!oid || seenOrders.has(oid)) continue;
      seenOrders.add(oid);
      const order = orderMap.get(oid);
      if (order) {
        threads.push({
          orderId: order._id,
          externalOrderId: order.externalOrderId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          orderValue: order.orderValue,
          status: order.status,
          paymentMethod: order.paymentMethod,
          carrier: order.carrier,
          awb: order.awb,
          claimedUtr: (order.codConversion as any)?.claimedUtr || null,
          lastMessageAt: log.createdAt,
          lastMessageBody: log.body,
          lastDirection: log.direction,
        });
      }
    }

    res.status(200).json(threads);
  } catch (err: any) {
    logger.error('Failed to fetch recent chats', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch recent conversations' });
  }
});

/**
 * GET /api/orders/:id
 * Get single order details with full audit logs
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const orderId = req.params.id;

  try {
    logger.info('Fetching order details', { merchantId, orderId });

    if (typeof orderId !== 'string' || !Types.ObjectId.isValid(orderId)) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Retrieve corresponding audit logs
    const auditLogs = await AuditLog.find({ orderId: order._id, merchantId }).sort({ timestamp: -1 });

    // Retrieve corresponding WhatsApp message logs
    const messages = await MessageLog.find({ orderId: order._id, merchantId }).sort({ createdAt: 1 });

    res.status(200).json({
      order,
      auditLogs,
      messages,
    });
  } catch (err: any) {
    logger.error('Failed to get order details', { merchantId, orderId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve order details' });
  }
});

/**
 * POST /api/orders/:orderId/assess-risk
 * Calculate and update RTO risk assessment for an order
 */
router.post('/:orderId/assess-risk', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const orderId = req.params.orderId;

  if (typeof orderId !== 'string' || !Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ error: 'Invalid order ID' });
    return;
  }

  try {
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const { rtoRiskService } = await import('../services/rto-risk.service');
    const risk = await rtoRiskService.assessOrder(merchantId!, {
      customerPhone: order.customerPhone,
      orderValue: order.orderValue,
      pincode: (order as any).shippingAddress?.pincode,
      address: typeof (order as any).shippingAddress === 'string'
        ? (order as any).shippingAddress
        : (order as any).shippingAddress?.fullAddress,
    });

    order.rtoRisk = risk;
    await order.save();

    res.status(200).json(risk);
  } catch (err: any) {
    logger.error('Failed to assess order risk', { merchantId, orderId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:orderId/risk-action
 * Execute merchant triage action on a flagged high/medium risk order
 */
router.post('/:orderId/risk-action', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const orderId = req.params.orderId;
  const { action } = req.body; // 'whatsapp_verify', 'require_deposit', 'manual_review_approve'

  if (typeof orderId !== 'string' || !Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ error: 'Invalid order ID' });
    return;
  }

  try {
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (action === 'manual_review_approve') {
      if (!order.rtoRisk) {
        order.rtoRisk = {
          score: 0,
          level: 'LOW',
          factors: [],
          recommendedAction: 'auto_ship',
          scoredAt: new Date(),
        };
      }
      order.rtoRisk.level = 'LOW';
      order.rtoRisk.score = 0;
      order.rtoRisk.factors.push('merchant_overridden');
      order.rtoRisk.recommendedAction = 'auto_ship';
      await order.save();

      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'rto_risk_overridden_by_merchant',
        source: 'orders_api',
        status: 'success',
      });
    } else if (action === 'whatsapp_verify') {
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'rto_whatsapp_verify_requested',
        source: 'orders_api',
        status: 'success',
      });
    } else if (action === 'require_deposit') {
      await AuditLog.create({
        merchantId: order.merchantId,
        orderId: order._id,
        action: 'rto_partial_deposit_requested',
        source: 'orders_api',
        status: 'success',
      });
    } else {
      res.status(400).json({ error: `Unknown risk action: ${action}` });
      return;
    }

    res.status(200).json({ success: true, rtoRisk: order.rtoRisk });
  } catch (err: any) {
    logger.error('Failed to execute risk action', { merchantId, orderId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:orderId/resend-payment-link
 * Generate a fresh 15-minute payment link and dispatch it to customer WhatsApp
 */
router.post('/:orderId/resend-payment-link', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const orderId = req.params.orderId;

  if (typeof orderId !== 'string' || !Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ error: 'Invalid order ID' });
    return;
  }

  try {
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status === 'converted_to_prepaid' || order.status === 'ndr_rescued') {
      res.status(400).json({ error: 'Order is already marked as prepaid' });
      return;
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const { orderService } = await import('../services/order.service');
    const freshLink = await orderService.generateRetentionPaymentLink(order, merchant);
    if (!freshLink?.shortUrl) {
      res.status(500).json({ error: 'Failed to generate payment link with gateway' });
      return;
    }

    // Dispatch link via WhatsApp
    let waToken: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        const { encryptionService } = await import('../services/encryption.service');
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {}
    }

    const waConfig = {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };

    const { whatsAppService } = await import('../services/whatsapp.service');
    await whatsAppService.sendText(
      order.customerPhone,
      `Here is your fresh payment link for Order #${order.externalOrderId}:\n${freshLink.shortUrl}\n\n⏰ Valid for 15 minutes. Pay via UPI to confirm priority delivery.`,
      waConfig
    ).catch(() => {});

    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: 'payment_link_resent_by_merchant',
      source: 'orders_api',
      payload: { paymentLinkId: freshLink.linkId, shortUrl: freshLink.shortUrl },
      status: 'success',
    });

    res.status(200).json({ success: true, paymentLinkUrl: freshLink.shortUrl });
  } catch (err: any) {
    logger.error('Failed to resend payment link', { merchantId, orderId, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to resend payment link' });
  }
});

/**
 * POST /api/orders/:orderId/reconcile-utr
 * Verify / override payment for an order using customer-submitted UTR and amend courier COD balance
 */
router.post('/:orderId/reconcile-utr', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const orderId = req.params.orderId;
  const { utr } = req.body || {};

  if (typeof orderId !== 'string' || !Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ error: 'Invalid order ID' });
    return;
  }

  try {
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const finalUtr = utr || order.codConversion?.claimedUtr || 'MANUAL_VERIFIED';
    const isNdrOrder = (order.status || '').startsWith('ndr_') || order.status === 'rto_initiated' || order.status === 'rto';
    const nextStatus = isNdrOrder ? 'ndr_rescued' : 'converted_to_prepaid';

    order.status = nextStatus as any;
    if (!order.codConversion) {
      order.codConversion = {
        convertedAt: new Date(),
        claimedUtr: finalUtr,
      };
    } else {
      order.codConversion.convertedAt = new Date();
      order.codConversion.claimedUtr = finalUtr;
    }
    await order.save();

    // Amend courier COD amount to ₹0
    try {
      const { codAdjustmentService } = require('../services/courier/cod-adjustment.service');
      const discount = order.codConversion?.incentiveOffered || 0;
      await codAdjustmentService.adjustCodAmount({
        orderId: order._id.toString(),
        paymentId: order.paymentLinkId || `utr_${finalUtr}`,
        paidAmountInInr: Math.max(1, order.orderValue - discount),
      });
    } catch (codErr: any) {
      logger.warn('Failed to adjust COD amount with courier during manual reconciliation', { error: codErr?.message });
    }

    // Sync to Shopify / WooCommerce
    const { orderService } = await import('../services/order.service');
    await orderService.markOrderAsPaidOnPlatform(order, merchant);

    // Dispatch WhatsApp confirmation
    let waToken: string | undefined;
    if (merchant.whatsappConfig?.accessToken) {
      try {
        const { encryptionService } = await import('../services/encryption.service');
        waToken = encryptionService.decrypt(merchant.whatsappConfig.accessToken);
      } catch {}
    }

    const waConfig = {
      phoneNumberId: merchant.whatsappConfig?.phoneNumberId,
      accessToken: waToken,
      businessAccountId: merchant.whatsappConfig?.businessAccountId,
    };
    const { whatsAppService } = await import('../services/whatsapp.service');
    await whatsAppService.sendText(
      order.customerPhone,
      `✅ Payment confirmed! Your payment for Order #${order.externalOrderId} (UTR: ${finalUtr}) has been verified. Doorstep cash balance adjusted to ₹0. Thank you!`,
      waConfig
    ).catch(() => {});

    await AuditLog.create({
      merchantId: order.merchantId,
      orderId: order._id,
      action: 'payment_reconciled_via_utr',
      source: 'orders_api',
      payload: { utr: finalUtr, newStatus: nextStatus },
      status: 'success',
    });

    res.status(200).json({ success: true, message: 'Order reconciled as prepaid and courier balance cleared', order });
  } catch (err: any) {
    logger.error('Failed to reconcile UTR', { merchantId, orderId, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to reconcile UTR' });
  }
});

export default router;
