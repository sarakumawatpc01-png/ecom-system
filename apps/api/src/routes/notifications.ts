import { Router } from 'express';
import { z } from 'zod';
import { sendTransactionalEmail } from '../services/emailService';

const router = Router();

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1)
});

router.post('/email', async (req, res) => {
  const parsed = emailSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const sent = await sendTransactionalEmail(parsed.data.to, parsed.data.subject, parsed.data.html);
  return res.json({ ok: true, data: { sent } });
});

router.post('/push', async (req, res) => {
  const userId = String(req.body?.user_id || '');
  const message = String(req.body?.message || '');
  if (!userId || !message) return res.status(400).json({ ok: false, message: 'user_id and message are required' });
  return res.json({ ok: true, data: { delivered: true, user_id: userId, message } });
});

export default router;
