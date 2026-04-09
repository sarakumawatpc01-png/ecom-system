import { Queue } from 'bullmq';

type EmailJobPayload = Record<string, unknown>;
type QueueJob = { id: string; name: string; payload: EmailJobPayload };

const hasRedis = Boolean(process.env.REDIS_URL);
const queue = hasRedis
  ? new Queue<EmailJobPayload>('emailQueue', {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true }
    })
  : null;

const memoryJobs: QueueJob[] = [];

export const emailQueue = {
  async add(name: string, payload: EmailJobPayload) {
    if (queue) {
      const job = await queue.add(name, payload);
      return { id: String(job.id), name, payload };
    }
    const job = { id: `emailQueue-${Date.now()}`, name, payload };
    memoryJobs.push(job);
    return job;
  },
  async drainMemoryJobs() {
    const items = [...memoryJobs];
    memoryJobs.length = 0;
    return items;
  },
  getQueue() {
    return queue;
  }
};
