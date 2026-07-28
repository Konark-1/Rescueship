import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { standardMerchantLimiter } from '../middleware/merchant-rate-limiter';
import { sandboxService } from '../services/sandbox.service';
import { Merchant } from '../models/Merchant';
import { whatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/sandbox/status
 * Returns current sandbox state for the authenticated merchant.
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await sandboxService.getSandboxState(req.merchant!.merchantId);
    res.json({ success: true, sandbox: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sandbox/toggle
 * Body: { enabled: boolean }
 */
router.post('/toggle', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    }

    const state = await sandboxService.setSandboxMode(req.merchant!.merchantId, enabled);
    res.json({ success: true, sandbox: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sandbox/simulate-ndr
 * Triggers a simulated NDR event → sends rescue WhatsApp to merchant's own phone.
 * Only works when sandbox is enabled.
 */
router.post('/simulate-ndr', authenticateToken, standardMerchantLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    const sandbox = (merchant as any).sandbox;
    if (!sandbox?.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Sandbox mode is not enabled. Enable it first via POST /api/sandbox/toggle',
      });
    }

    if (sandbox.graduated) {
      return res.status(400).json({
        success: false,
        error: 'You have already graduated from sandbox. Disable and re-enable to reset.',
      });
    }

    const ownerPhone = (merchant as any).ownerPhone;
    if (!ownerPhone) {
      return res.status(400).json({ success: false, error: 'No owner phone set. Complete onboarding first.' });
    }

    // Generate simulated NDR
    const simNDR = sandboxService.generateSimulatedNDR(merchantId, ownerPhone);

    // Send rescue template to self
    let whatsappResult = { success: false, error: '' };
    try {
      await whatsAppService.sendTemplate(
        ownerPhone,
        'ndr_rescue_en',
        'en',
        [
          { type: 'body', parameters: [{ type: 'text', text: 'Customer' }, { type: 'text', text: simNDR.orderId }] }
        ],
        (merchant as any).whatsappConfig
      );
      whatsappResult.success = true;
      await sandboxService.recordTestRescue(merchantId, true);
    } catch (e: any) {
      whatsappResult.error = e.message;
      await sandboxService.recordTestRescue(merchantId, false);
    }

    // Get updated sandbox state
    const updatedState = await sandboxService.getSandboxState(merchantId);

    res.json({
      success: true,
      simulation: simNDR,
      whatsapp: whatsappResult,
      sandbox: updatedState,
      graduationProgress: `${updatedState.testRescuesSucceeded}/${updatedState.graduationThreshold}`,
    });
  } catch (err: any) {
    logger.error('[Sandbox] simulate-ndr failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sandbox/graduate
 * Manually graduate (skip the 3-rescue threshold).
 */
router.post('/graduate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchant!.merchantId;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    const sandbox = (merchant as any).sandbox || {};
    sandbox.graduated = true;
    sandbox.graduatedAt = new Date();
    sandbox.enabled = false;
    (merchant as any).sandbox = sandbox;
    await merchant.save();

    logger.info(`[Sandbox] Manual graduation for ${merchantId}`);
    res.json({ success: true, message: 'Sandbox graduated. You are now live.', sandbox });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sandbox/alerts
 */
router.get('/alerts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchant!.merchantId).lean();
    const alerts = (merchant as any)?.alerts || [];
    const unread = alerts.filter((a: any) => !a.read).length;
    res.json({ success: true, alerts, unreadCount: unread });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sandbox/alerts/:alertId/read
 */
router.post('/alerts/:alertId/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Merchant.updateOne(
      { _id: req.merchant!.merchantId, 'alerts.id': req.params.alertId },
      { $set: { 'alerts.$.read': true } }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sandbox/quality
 */
router.get('/quality', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchant!.merchantId).lean();
    const quality = (merchant as any)?.quality || null;
    res.json({ success: true, quality });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
