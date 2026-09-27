import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { requireFeature } from '../middleware/planGating.middleware';
import { Order, AuditLog } from '../models';
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

    res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error('Failed to list orders', { merchantId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve orders' });
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

    res.status(200).json({
      order,
      auditLogs,
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

export default router;
