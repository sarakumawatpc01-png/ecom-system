import { Worker } from 'bullmq';
import { deploymentQueue } from '../queues/deploymentQueue';
import { processDeploymentJob } from '../services/deployments/service';

export const startDeploymentWorker = () => {
  const queue = deploymentQueue.getQueue();
  if (queue && process.env.REDIS_URL) {
    const worker = new Worker(
      'deploymentQueue',
      async (job) => {
        await processDeploymentJob(String(job.data.deploymentJobId));
      },
      { connection: { url: process.env.REDIS_URL } }
    );

    worker.on('failed', (job, error) => {
      console.error('[deploymentWorker] job failed', { jobId: job?.id, error: error.message });
    });

    return 'deploymentWorker started (bullmq)';
  }

  const timer = setInterval(async () => {
    const jobs = await deploymentQueue.drainMemoryJobs();
    for (const job of jobs) {
      try {
        await processDeploymentJob(job.payload.deploymentJobId);
      } catch (error) {
        console.error('[deploymentWorker-memory] job failed', {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'unknown error'
        });
      }
    }
  }, 2000);

  timer.unref();
  return 'deploymentWorker started (memory queue)';
};
