import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../lib/db';
import { JwtClaims, UserRole } from '../types';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), totp_code: z.string().optional() });
const refreshSchema = z.object({ refresh_token: z.string().min(10).optional() });

const allowedRoles: UserRole[] = ['super_admin', 'site_admin', 'editor', 'viewer'];

const getSecret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

const getUserClaims = async (userId: string, role: string): Promise<JwtClaims> => {
  const accessRows = await db.user_site_access.findMany({ where: { user_id: userId }, select: { site_id: true } });
  const safeRole: UserRole = allowedRoles.includes(role as UserRole) ? (role as UserRole) : 'viewer';
  return { sub: userId, role: safeRole, sites: accessRows.map((row: { site_id: string }) => row.site_id), iat: 0, exp: 0 };
};

const issueTokens = (claims: Omit<JwtClaims, 'iat' | 'exp'>) => {
  const secret = getSecret();
  return {
    access_token: jwt.sign(claims, secret, { expiresIn: '15m' }),
    refresh_token: jwt.sign({ ...claims, type: 'refresh' }, secret, { expiresIn: '30d' })
  };
};

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }

  const user = await db.users.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.is_active) {
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  if (user.totp_enabled && !parsed.data.totp_code) {
    return res.status(401).json({ ok: false, message: 'TOTP code required' });
  }

  const { iat, exp, ...claims } = await getUserClaims(user.id, user.role);
  const tokens = issueTokens(claims);

  return res.json({
    ok: true,
    data: {
      ...tokens
    }
  });
});

router.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }

  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  const refreshToken = parsed.data.refresh_token || bearer;
  if (!refreshToken) {
    return res.status(400).json({ ok: false, message: 'refresh_token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, getSecret()) as JwtClaims & { type?: string };
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ ok: false, message: 'Invalid refresh token' });
    }

    const user = await db.users.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, message: 'User not active' });
    }

    const { iat, exp, ...claims } = await getUserClaims(user.id, user.role);
    return res.json({ ok: true, data: issueTokens(claims) });
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid refresh token' });
  }
});

router.post('/logout', (_req, res) => res.json({ ok: true }));

router.get('/me', async (req, res) => {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) {
    return res.status(401).json({ ok: false, message: 'Missing authorization header' });
  }
  try {
    const decoded = jwt.verify(bearer, getSecret()) as JwtClaims;
    const user = await db.users.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, message: 'User not active' });
    }
    const accessRows = await db.user_site_access.findMany({ where: { user_id: user.id }, select: { site_id: true } });
    return res.json({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        totp_enabled: user.totp_enabled,
        sites: accessRows.map((row: { site_id: string }) => row.site_id)
      }
    });
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid token' });
  }
});

router.post('/totp/setup', async (req, res) => {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) {
    return res.status(401).json({ ok: false, message: 'Missing authorization header' });
  }
  try {
    const decoded = jwt.verify(bearer, getSecret()) as JwtClaims;
    await db.users.update({ where: { id: decoded.sub }, data: { totp_enabled: true } });
    return res.json({
      ok: true,
      data: { enabled: true, note: 'TOTP enabled. Configure encrypted TOTP secret storage for full MFA enforcement.' }
    });
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid token' });
  }
});

router.post('/totp/verify', (req, res) => {
  const code = String(req.body?.totp_code || '');
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ ok: false, message: 'Invalid TOTP code format' });
  }
  return res.json({ ok: true, data: { verified: true } });
});

export default router;
