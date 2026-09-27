import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { geminiService } from '../services/gemini.service';

const router = Router();

// POST /api/ai/parse-address
router.post('/parse-address', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text payload required' });
  }

  try {
    const parsed = await geminiService.parseAddress(text);
    if (!parsed) {
      return res.status(503).json({ error: 'AI parsing unavailable or failed' });
    }
    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
