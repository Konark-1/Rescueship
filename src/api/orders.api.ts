import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { Order, AuditLog } from '../models';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/orders
 * List orders with pagination and filters
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;

  // Filters
  const status = req.query.status as string;
  const carrier = req.query.carrier as string;
  const search = req.query.search as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  const query: any = { merchantId };

  if (status) query.status = status;
  if (carrier) query.carrier = carrier;

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
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
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

export default router;
