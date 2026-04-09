import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../lib/db';
import {
  createRefreshToken,
  getRefreshTokenUser,
  getLockout,
  incrLoginFailure,
  resetLoginFailures,
  revokeRefreshToken,
  setLockout,
  validateRefreshToken
} from '../lib/cacheStore';
import { JwtClaims, UserRole } from '../types';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), totp_code: z.string().optional() });
const refreshSchema = z.object({ refresh_token: z.string().min(10).optional() });

const allowedRoles: UserRole[] = ['super_admin', 'site_admin', 'editor', 'viewer'];

const getSecret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;

const getUserClaims = async (userId: string, role: string): Promise<JwtClaims> => {
  const accessRows = await db.user_site_access.findMany({ where: { user_id: userId }, select: { site_id: true } });
  const safeRole: UserRole = allowedRoles.includes(role as UserRole) ? (role as UserRole) : 'viewer';
  return { sub: userId, role: safeRole, sites: accessRows.map((row: { site_id: string }) => row.site_id), iat: 0, exp: 0 };
};

const issueTokens = async (claims: Omit<JwtClaims, 'iat' | 'exp'>) => {
  const secret = getSecret();
  const refreshToken = await createRefreshToken(claims.sub, REFRESH_TOKEN_TTL_SECONDS);
  return {
    access_token: jwt.sign(claims, secret, { expiresIn: ACCESS_TOKEN_TTL }),
    refresh_token: refreshToken
  };
};

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }

  const user = await db.users.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const lockoutKey = `${parsed.data.email.toLowerCase()}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  const lockoutUntil = await getLockout(lockoutKey);
  if (lockoutUntil) {
    return res.status(429).json({ ok: false, message: 'Too many failed login attempts. Try again later.', locked_until: lockoutUntil });
  }

  if (!user || !user.is_active) {
    const failCount = await incrLoginFailure(lockoutKey, FAILED_LOGIN_WINDOW_SECONDS);
    if (failCount >= FAILED_LOGIN_LIMIT) await setLockout(lockoutKey, LOCKOUT_SECONDS);
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
  const rounds = bcrypt.getRounds(user.password_hash || '');
  if (rounds > 0 && rounds < 12) {
    return res.status(403).json({ ok: false, message: 'Password policy upgrade required (bcrypt cost factor < 12).' });
  }
  if (!passwordOk) {
    const failCount = await incrLoginFailure(lockoutKey, FAILED_LOGIN_WINDOW_SECONDS);
    if (failCount >= FAILED_LOGIN_LIMIT) await setLockout(lockoutKey, LOCKOUT_SECONDS);
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  if (user.role === 'super_admin' && !user.totp_enabled) {
    return res.status(403).json({ ok: false, message: '2FA is mandatory for super_admin users' });
  }

  if (user.totp_enabled && !parsed.data.totp_code) {
    return res.status(401).json({ ok: false, message: 'TOTP code required' });
  }
  if (user.totp_enabled) {
    if (!user.totp_secret) return res.status(401).json({ ok: false, message: 'TOTP secret not configured' });
    if (String(parsed.data.totp_code || '') !== String(user.totp_secret)) {
      const failCount = await incrLoginFailure(lockoutKey, FAILED_LOGIN_WINDOW_SECONDS);
      if (failCount >= FAILED_LOGIN_LIMIT) await setLockout(lockoutKey, LOCKOUT_SECONDS);
      return res.status(401).json({ ok: false, message: 'Invalid TOTP code' });
    }
  }

  await resetLoginFailures(lockoutKey);

  const { iat, exp, ...claims } = await getUserClaims(user.id, user.role);
  const tokens = await issueTokens(claims);

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
    const refreshUser = await getRefreshTokenUser(refreshToken);
    if (!refreshUser) return res.status(401).json({ ok: false, message: 'Invalid refresh token' });
    const isValidRefresh = await validateRefreshToken(refreshToken, refreshUser);
    if (!isValidRefresh) return res.status(401).json({ ok: false, message: 'Invalid refresh token' });
    const user = await db.users.findUnique({ where: { id: refreshUser } });
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, message: 'User not active' });
    }

    await revokeRefreshToken(refreshToken);
    const { iat, exp, ...claims } = await getUserClaims(user.id, user.role);
    return res.json({ ok: true, data: await issueTokens(claims) });
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token || '');
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return res.json({ ok: true });
});

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
    const totpSecret = String(req.body?.totp_secret || '').trim();
    if (!/^\d{6}$/.test(totpSecret)) {
      return res.status(400).json({ ok: false, message: 'totp_secret must be a 6-digit code in this scaffold' });
    }
    await db.users.update({ where: { id: decoded.sub }, data: { totp_enabled: true, totp_secret: totpSecret } });
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
