import { syncGscForAllSites } from '../services/monitoring/gsc';

const cron = require('node-cron') as { schedule: (expression: string, callback: () => void) => void };

const defaultSchedule = '0 */6 * * *';

export const startGscWorker = () => {
  if (process.env.GSC_SYNC_ENABLED === 'false') return 'gscWorker disabled';
  const schedule = process.env.GSC_SYNC_CRON || defaultSchedule;
  cron.schedule(schedule, () => void syncGscForAllSites());
  return 'gscWorker started';
};
