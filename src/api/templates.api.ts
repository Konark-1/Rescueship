import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { WhatsAppTemplate } from '../models';
import { logger } from '../utils/logger';

const router = Router();

// GET all templates
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const templates = await WhatsAppTemplate.find({ merchantId });
    res.status(200).json(templates);
  } catch (err: any) {
    logger.error('Failed to fetch templates', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET single template
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const template = await WhatsAppTemplate.findOne({ _id: req.params.id, merchantId });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.status(200).json(template);
  } catch (err: any) {
    logger.error('Failed to fetch template', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST new template
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const newTemplate = new WhatsAppTemplate({
      merchantId,
      ...req.body
    });
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (err: any) {
    logger.error('Failed to create template', { error: err.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT update template
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const updated = await WhatsAppTemplate.findOneAndUpdate(
      { _id: req.params.id, merchantId },
      req.body,
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (err: any) {
    logger.error('Failed to update template', { error: err.message });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE template
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const deleted = await WhatsAppTemplate.findOneAndDelete({ _id: req.params.id, merchantId });
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.status(200).json({ message: 'Template deleted' });
  } catch (err: any) {
    logger.error('Failed to delete template', { error: err.message });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST submit to mock meta template submission
router.post('/:id/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    const template = await WhatsAppTemplate.findOne({ _id: req.params.id, merchantId });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    // Mock submission - just change status to approved
    template.status = 'approved';
    await template.save();
    res.status(200).json({ message: 'Template submitted and approved', template });
  } catch (err: any) {
    logger.error('Failed to submit template', { error: err.message });
    res.status(500).json({ error: 'Failed to submit template' });
  }
});

export default router;
