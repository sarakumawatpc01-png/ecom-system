import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { requireRole } from '../../middleware/auth';
import { executeAiProvider } from '../../services/ai/providerExecutor';
import { decryptText, encryptText } from '../../utils/crypto';

const router = Router();
router.use(requireRole('super_admin', 'site_admin'));

const configSchema = z.object({
  provider: z.string().min(2),
  model: z.string().min(1),
  task_type: z.string().min(2),
  api_key: z.string().min(6),
  is_active: z.boolean().optional(),
  priority: z.number().int().optional(),
  settings: z.record(z.unknown()).optional()
});

const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret';

const decryptApiKey = (cipher: string) => decryptText(cipher, cryptoSecret);

router.get('/', async (_req, res) => {
  const items = await db.ai_model_config.findMany({ orderBy: [{ task_type: 'asc' }, { priority: 'asc' }] });
  return res.json({
    ok: true,
    data: items.map((item: any) => ({
      ...item,
      api_key_encrypted: undefined,
      has_api_key: Boolean(item.api_key_encrypted)
    }))
  });
});

router.post('/', async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const encrypted = encryptText(parsed.data.api_key, cryptoSecret);
  const item = await db.ai_model_config.create({
    data: {
      provider: parsed.data.provider,
      model: parsed.data.model,
      task_type: parsed.data.task_type,
      api_key_encrypted: encrypted,
      is_active: parsed.data.is_active ?? true,
      priority: parsed.data.priority ?? 1,
      settings: parsed.data.settings || {}
    }
  });
  return res.status(201).json({ ok: true, data: { ...item, api_key_encrypted: undefined, has_api_key: true } });
});

router.put('/:id', async (req, res) => {
  const parsed = configSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.api_key) {
    updateData.api_key_encrypted = encryptText(parsed.data.api_key, cryptoSecret);
    delete updateData.api_key;
  }
  const result = await db.ai_model_config.updateMany({ where: { id: req.params.id }, data: updateData });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Config not found' });
  const item = await db.ai_model_config.findUnique({ where: { id: req.params.id } });
  return res.json({ ok: true, data: { ...item, api_key_encrypted: undefined, has_api_key: Boolean(item?.api_key_encrypted) } });
});

router.delete('/:id', async (req, res) => {
  const result = await db.ai_model_config.deleteMany({ where: { id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Config not found' });
  return res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const configId = String(req.body?.config_id || '');
  const prompt = String(req.body?.prompt || 'Say hello in one line');
  if (!configId) return res.status(400).json({ ok: false, message: 'config_id is required' });
  const config = await db.ai_model_config.findUnique({ where: { id: configId } });
  if (!config) return res.status(404).json({ ok: false, message: 'Config not found' });
  const apiKey = decryptApiKey(config.api_key_encrypted);
  if (!apiKey) return res.status(400).json({ ok: false, message: 'Unable to decrypt api key' });
  const output = await executeAiProvider({
    provider: config.provider,
    model: config.model,
    apiKey,
    prompt,
    taskType: config.task_type,
    settings: (config.settings as Record<string, unknown>) || {}
  });
  return res.json({ ok: true, data: output });
});

router.get('/providers', (_req, res) => {
  return res.json({
    ok: true,
    data: ['openai', 'openrouter', 'google', 'claude', 'deepseek', 'sarvam', 'router']
  });
});

export default router;
