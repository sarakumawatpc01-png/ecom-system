import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { requireRole } from '../../middleware/auth';
import { executeAiProvider } from '../../services/ai/providerExecutor';
import { decryptText, encryptText } from '../../utils/crypto';

const router = Router();
router.use(requireRole('super_admin', 'site_admin'));

const supportedProviders = ['openrouter', 'deepseek', 'sarvam', 'claude', 'openai', 'google', 'anthropic'] as const;
const supportedTasks = [
  'copywriting',
  'description_rewrite',
  'title_rewrite',
  'seo_meta',
  'seo_audit',
  'content_brief',
  'schema_generation',
  'review_filter',
  'translation',
  'ad_copy',
  'landing_page_copy',
  'image_generation',
  'video_generation',
  'image_background_removal'
] as const;

const configSchema = z.object({
  provider: z.enum(supportedProviders),
  model: z.string().min(1),
  task_type: z.enum(supportedTasks),
  api_key: z.string().min(6),
  is_active: z.boolean().optional(),
  priority: z.number().int().optional(),
  settings: z.record(z.unknown()).optional()
});

const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret';

const decryptApiKey = (cipher: string) => decryptText(cipher, cryptoSecret);
const normalizeProvider = (provider: string) => (provider === 'anthropic' ? 'claude' : provider);
const maskApiKey = (cipher: string) => {
  const raw = decryptApiKey(cipher);
  return raw ? `••••${raw.slice(-4)}` : null;
};

router.get('/', async (_req, res) => {
  const items = await db.ai_model_config.findMany({ orderBy: [{ task_type: 'asc' }, { priority: 'asc' }] });
  return res.json({
    ok: true,
    data: items.map((item: any) => ({
      ...item,
      provider: normalizeProvider(String(item.provider || '')),
      api_key_encrypted: undefined,
      has_api_key: Boolean(item.api_key_encrypted),
      api_key_last4: maskApiKey(String(item.api_key_encrypted || ''))
    }))
  });
});

router.post('/', async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const encrypted = encryptText(parsed.data.api_key, cryptoSecret);
  const item = await db.ai_model_config.create({
    data: {
      provider: normalizeProvider(parsed.data.provider),
      model: parsed.data.model,
      task_type: parsed.data.task_type,
      api_key_encrypted: encrypted,
      is_active: parsed.data.is_active ?? true,
      priority: parsed.data.priority ?? 1,
      settings: (parsed.data.settings || {}) as any
    }
  });
  return res.status(201).json({ ok: true, data: { ...item, api_key_encrypted: undefined, has_api_key: true } });
});

router.put('/:id', async (req, res) => {
  const parsed = configSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const updateData: Record<string, unknown> = { ...parsed.data } as any;
  if (parsed.data.api_key) {
    updateData.api_key_encrypted = encryptText(parsed.data.api_key, cryptoSecret);
    delete updateData.api_key;
  }
  if (typeof updateData.provider === 'string') updateData.provider = normalizeProvider(updateData.provider);
  const result = await db.ai_model_config.updateMany({ where: { id: req.params.id }, data: updateData });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Config not found' });
  const item = await db.ai_model_config.findUnique({ where: { id: req.params.id } });
  return res.json({
    ok: true,
    data: {
      ...item,
      provider: normalizeProvider(String(item?.provider || '')),
      api_key_encrypted: undefined,
      has_api_key: Boolean(item?.api_key_encrypted),
      api_key_last4: item?.api_key_encrypted ? maskApiKey(item.api_key_encrypted) : null
    }
  });
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
    provider: normalizeProvider(config.provider),
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
    data: {
      openrouter: [],
      deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
      sarvam: ['sarvam-2b', 'sarvam-m'],
      claude: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'dall-e-3', 'dall-e-2'],
      google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'imagen-3', 'veo-2']
    }
  });
});

export default router;
