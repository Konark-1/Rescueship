import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { WhatsAppTemplate } from '../models';
import { Merchant } from '../models/Merchant';
import { encryptionService } from '../services/encryption.service';
import { whatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';

const router = Router();

function validId(id: unknown): id is string {
  return typeof id === 'string' && Types.ObjectId.isValid(id);
}

import { TEMPLATE_DEFS, buildComponents, metaTemplateService } from '../services/meta-template.service';

async function seedCanonicalTemplates(merchantId: string) {
  const docs = TEMPLATE_DEFS.map((d) => ({
    merchantId,
    templateName: d.name,
    language: d.language || 'en',
    category: d.category || 'UTILITY',
    status: 'approved',
    buttons: d.buttons || [],
    components: buildComponents(d),
  }));
  return WhatsAppTemplate.insertMany(docs);
}

// GET all templates - auto-seeds canonical playbooks if none exist
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    let templates = await WhatsAppTemplate.find({ merchantId });
    if (templates.length === 0 && merchantId) {
      await seedCanonicalTemplates(merchantId);
      templates = await WhatsAppTemplate.find({ merchantId });
    }
    res.status(200).json(templates);
  } catch (err: any) {
    logger.error('Failed to fetch templates', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST 1-click sync/deploy canonical playbooks to Meta WABA
router.post('/sync-meta', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  if (!merchantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    const hasLiveWhatsapp = Boolean(merchant.whatsappConfig?.businessAccountId && merchant.whatsappConfig?.accessToken);
    if (hasLiveWhatsapp) {
      const results = await metaTemplateService.submitAll(merchantId);
      res.status(200).json({
        success: true,
        live: true,
        message: 'All canonical recovery playbooks submitted to Meta WABA!',
        results,
      });
      return;
    }

    // Demo/simulated mode: ensure canonical templates exist in database with 'approved' status
    const existing = await WhatsAppTemplate.find({ merchantId });
    if (existing.length === 0) {
      await seedCanonicalTemplates(merchantId);
    } else {
      await WhatsAppTemplate.updateMany({ merchantId }, { $set: { status: 'approved' } });
    }
    const updated = await WhatsAppTemplate.find({ merchantId });
    res.status(200).json({
      success: true,
      live: false,
      message: 'Canonical recovery playbooks activated in Ready/Approved state.',
      templates: updated,
    });
  } catch (err: any) {
    logger.error('Failed to sync templates with Meta', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to sync templates' });
  }
});

// GET single template
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: 'Template not found' }); return; }
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
  const { templateName, language, category, buttons, components } = req.body;

  if (!templateName || typeof templateName !== 'string') {
    res.status(400).json({ error: 'templateName is required' });
    return;
  }
  if (!language || typeof language !== 'string') {
    res.status(400).json({ error: 'language is required' });
    return;
  }
  if (!category || typeof category !== 'string') {
    res.status(400).json({ error: 'category is required' });
    return;
  }

  try {
    const newTemplate = new WhatsAppTemplate({
      merchantId,
      templateName: templateName.trim(),
      language: language.trim(),
      category: category.trim(),
      status: 'pending',
      buttons: Array.isArray(buttons) ? buttons : [],
      components: Array.isArray(components) ? components : [],
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
  const { templateName, language, category, buttons, components } = req.body;

  const updateFields: Record<string, any> = {
    status: 'pending', // require re-review upon modification
  };

  if (typeof templateName === 'string' && templateName.trim()) updateFields.templateName = templateName.trim();
  if (typeof language === 'string' && language.trim()) updateFields.language = language.trim();
  if (typeof category === 'string' && category.trim()) updateFields.category = category.trim();
  if (Array.isArray(buttons)) updateFields.buttons = buttons;
  if (Array.isArray(components)) updateFields.components = components;

  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: 'Template not found' }); return; }
    const updated = await WhatsAppTemplate.findOneAndUpdate(
      { _id: req.params.id, merchantId },
      { $set: updateFields },
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
    if (!validId(req.params.id)) { res.status(404).json({ error: 'Template not found' }); return; }
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
    if (!validId(req.params.id)) { res.status(404).json({ error: 'Template not found' }); return; }
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

// POST test send template (direct preview or live WhatsApp dispatch)
router.post('/test-send', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const merchantId = req.merchant?.merchantId;
  const { templateName, phone } = req.body;
  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    const ownerPhone = (merchant as any).ownerPhone;
    const targetPhone = phone || ownerPhone || '+919999999999';
    const waCfg = (merchant as any).whatsappConfig;
    const hasLiveWhatsapp = Boolean(ownerPhone && waCfg?.phoneNumberId && waCfg?.accessToken);

    if (hasLiveWhatsapp) {
      try {
        const decryptedToken = encryptionService.decrypt(waCfg.accessToken);
        await whatsAppService.sendTemplate(
          ownerPhone!,
          templateName || 'ndr_rescue_en',
          'en',
          [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Merchant (Test)' },
                { type: 'text', text: 'TEST-' + Math.floor(1000 + Math.random() * 9000) },
                { type: 'text', text: 'Delhivery' },
              ],
            },
          ],
          {
            phoneNumberId: waCfg.phoneNumberId,
            accessToken: decryptedToken,
            businessAccountId: waCfg.businessAccountId,
          }
        );
        res.status(200).json({
          success: true,
          live: true,
          message: `Live test rescue sent via WhatsApp to ${ownerPhone}!`,
        });
        return;
      } catch (err: any) {
        logger.warn('Live test send failed, falling back to simulated preview', { error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      live: false,
      message: `Test rescue simulated for ${templateName || 'template'}. (Connect WhatsApp in Settings to receive live messages on your phone).`,
    });
  } catch (err: any) {
    logger.error('Failed to trigger template test', { error: err.message });
    res.status(500).json({ error: 'Failed to test template' });
  }
});

export default router;
