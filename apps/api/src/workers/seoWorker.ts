import cron from 'node-cron';
import { db } from '../lib/db';
import { runSeoAgentJob } from '../services/seoAgent';

type SeoScheduleType = 'nightly' | 'weekly' | 'monday' | 'monthly';

const defaultCron: Record<SeoScheduleType, string> = {
  nightly: '0 1 * * *',
  weekly: '0 2 * * 0',
  monday: '0 6 * * 1',
  monthly: '0 0 1 * *'
};

const resolveSchedule = (type: SeoScheduleType): string => {
  const envKey = `SEO_AGENT_CRON_${type.toUpperCase()}`;
  return process.env[envKey] || defaultCron[type];
};

const runForAllActiveSites = async (type: SeoScheduleType) => {
  const sites = await db.sites.findMany({ where: { is_deleted: false, status: 'active' }, select: { id: true } });
  for (const site of sites) {
    await runSeoAgentJob(site.id, type);
  }
};

export const startSeoWorker = () => {
  if (process.env.SEO_AGENT_ENABLED === 'false') return 'seoWorker disabled';
  cron.schedule(resolveSchedule('nightly'), () => void runForAllActiveSites('nightly'));
  cron.schedule(resolveSchedule('weekly'), () => void runForAllActiveSites('weekly'));
  cron.schedule(resolveSchedule('monday'), () => void runForAllActiveSites('monday'));
  cron.schedule(resolveSchedule('monthly'), () => void runForAllActiveSites('monthly'));
  return 'seoWorker started';
};
