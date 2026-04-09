import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), totp_code: z.string().optional() });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }

  await bcrypt.hash('placeholder', 10);

  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const claims = { sub: 'placeholder-user', role: 'super_admin', sites: [] };

  return res.json({
    ok: true,
    data: {
      access_token: jwt.sign(claims, secret, { expiresIn: '15m' }),
      refresh_token: jwt.sign({ ...claims, type: 'refresh' }, secret, { expiresIn: '30d' })
    }
  });
});

router.post('/refresh', (_req, res) => res.status(501).json({ ok: false, message: 'Not implemented' }));
router.post('/logout', (_req, res) => res.json({ ok: true }));
router.get('/me', (_req, res) => res.status(501).json({ ok: false, message: 'Not implemented' }));
router.post('/totp/setup', (_req, res) => res.status(501).json({ ok: false, message: 'Not implemented' }));
router.post('/totp/verify', (_req, res) => res.status(501).json({ ok: false, message: 'Not implemented' }));

export default router;
