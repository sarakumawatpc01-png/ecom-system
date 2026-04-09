import { Worker } from 'bullmq';
import { emailQueue } from '../queues/emailQueue';
import { sendTypedTransactionalEmail, TransactionalEmailType } from '../services/emailService';

const processPayload = async (name: string, data: Record<string, unknown>) => {
  const emailType = (name as TransactionalEmailType) || 'backup_status';
  const to = String(data.to || '');
  if (!to) return false;
  return sendTypedTransactionalEmail({
    siteId: data.site_id ? String(data.site_id) : null,
    to,
    type: emailType,
    payload: data
  });
};

export const startEmailWorker = () => {
  const queue = emailQueue.getQueue();
  if (queue && process.env.REDIS_URL) {
    const worker = new Worker(
      'emailQueue',
      async (job) => {
        await processPayload(job.name, job.data as Record<string, unknown>);
      },
      { connection: { url: process.env.REDIS_URL } }
    );
    worker.on('failed', (job, err) => {
      console.error('[emailWorker] job failed', { id: job?.id, error: err.message });
    });
    return 'emailWorker started (bullmq)';
  }

  const timer = setInterval(async () => {
    const jobs = await emailQueue.drainMemoryJobs();
    for (const job of jobs) {
      await processPayload(job.name, job.payload);
    }
  }, 2000);
  timer.unref();
  return 'emailWorker started (memory queue)';
};
