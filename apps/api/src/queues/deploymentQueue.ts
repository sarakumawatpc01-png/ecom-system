import { Queue } from 'bullmq';

type DeploymentJobPayload = {
  deploymentJobId: string;
};

type MemoryJob = { id: string; payload: DeploymentJobPayload };

const queue = process.env.REDIS_URL
  ? new Queue<DeploymentJobPayload>('deploymentQueue', {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    })
  : null;

const memoryJobs: MemoryJob[] = [];

export const deploymentQueue = {
  async add(payload: DeploymentJobPayload) {
    if (queue) {
      const job = await queue.add('deploy-site-zip', payload);
      return { id: String(job.id), payload };
    }
    const job = { id: `deployment-${Date.now()}-${Math.random()}`, payload };
    memoryJobs.push(job);
    return job;
  },
  async drainMemoryJobs() {
    const jobs = [...memoryJobs];
    memoryJobs.length = 0;
    return jobs;
  },
  getQueue() {
    return queue;
  }
};
