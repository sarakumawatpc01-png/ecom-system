import { db } from '../lib/db';
import { decryptText } from '../utils/crypto';
import { ensureMediaBucket } from './objectStorage';

type CheckResult = { ok: boolean; details: Record<string, unknown> };
type ActiveModelConfig = Awaited<ReturnType<typeof db.ai_model_config.findMany>>[number];

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'AI_CONFIG_ENCRYPTION_SECRET',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY'
];

const requiredAiTasks = ['copywriting', 'image_generation', 'video_generation'];
const supportedProviders = new Set(['openai', 'openrouter', 'google', 'claude', 'deepseek', 'sarvam']);
const mapProviderAlias = (provider: string) => (provider === 'anthropic' ? 'claude' : provider);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const runEnvCheck = (): CheckResult => {
  const missing = requiredEnvVars.filter((name) => !process.env[name]);
  return {
    ok: missing.length === 0,
    details: { required: requiredEnvVars, missing }
  };
};

const runDatabaseCheck = async (): Promise<CheckResult> => {
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, details: { reachable: true } };
  } catch (error) {
    return {
      ok: false,
      details: { reachable: false, error: error instanceof Error ? error.message : 'Database connection failed' }
    };
  }
};

const runMinioCheck = async (): Promise<CheckResult> => {
  try {
    await ensureMediaBucket();
    return { ok: true, details: { bucketReady: true } };
  } catch (error) {
    return {
      ok: false,
      details: { bucketReady: false, error: error instanceof Error ? error.message : 'MinIO check failed' }
    };
  }
};

const runProviderCheck = async (): Promise<CheckResult> => {
  const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || '';
  if (!cryptoSecret) {
    return { ok: false, details: { error: 'Missing encryption secret for AI provider key validation' } };
  }

  try {
    const activeConfigs = await db.ai_model_config.findMany({
      where: { is_active: true },
      orderBy: [{ task_type: 'asc' }, { priority: 'asc' }]
    });

    const byTask = new Map<string, (typeof activeConfigs)[number][]>();
    for (const item of activeConfigs) {
      const list = byTask.get(item.task_type) || [];
      list.push(item);
      byTask.set(item.task_type, list);
    }

    const missingTasks = requiredAiTasks.filter((task) => (byTask.get(task) || []).length === 0);
    const issues: Array<Record<string, string>> = [];

    for (const config of activeConfigs) {
      const provider = mapProviderAlias(config.provider.toLowerCase());
      if (!supportedProviders.has(provider)) {
        issues.push({ task: config.task_type, provider, issue: 'unsupported_provider' });
      }
      const apiKey = decryptText(config.api_key_encrypted, cryptoSecret);
      if (!apiKey) {
        issues.push({ task: config.task_type, provider, issue: 'api_key_decryption_failed' });
      }

      if (config.task_type === 'image_generation' && !['openai', 'google'].includes(provider)) {
        issues.push({ task: config.task_type, provider, issue: 'provider_not_supported_for_image_generation' });
      }
      if (config.task_type === 'video_generation' && provider !== 'google') {
        issues.push({ task: config.task_type, provider, issue: 'provider_not_supported_for_video_generation' });
      }

      const settings = asRecord(config.settings);
      if (provider === 'google' && config.task_type === 'image_generation') {
        const hasEndpoint = Boolean(settings.imagen_endpoint || process.env.GOOGLE_IMAGEN_ENDPOINT);
        if (!hasEndpoint) issues.push({ task: config.task_type, provider, issue: 'missing_google_imagen_endpoint' });
      }
      if (provider === 'google' && config.task_type === 'video_generation') {
        const hasEndpoint = Boolean(settings.veo_endpoint || process.env.GOOGLE_VEO_ENDPOINT);
        if (!hasEndpoint) issues.push({ task: config.task_type, provider, issue: 'missing_google_veo_endpoint' });
      }
    }

    return {
      ok: missingTasks.length === 0 && issues.length === 0,
      details: {
        requiredTasks: requiredAiTasks,
        missingTasks,
        activeConfigCount: activeConfigs.length,
        activeConfigs: activeConfigs.map((item: ActiveModelConfig) => ({
          task_type: item.task_type,
          provider: item.provider,
          model: item.model,
          priority: item.priority
        })),
        issues
      }
    };
  } catch (error) {
    return {
      ok: false,
      details: { error: error instanceof Error ? error.message : 'Provider check failed' }
    };
  }
};

export const runStartupAudit = async () => {
  const env = runEnvCheck();
  const database = await runDatabaseCheck();
  const minio = await runMinioCheck();
  const providers = await runProviderCheck();
  const ok = env.ok && database.ok && minio.ok && providers.ok;
  return { ok, checks: { env, database, minio, providers } };
};
