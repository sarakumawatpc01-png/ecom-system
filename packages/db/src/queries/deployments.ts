import { db } from '../client';

export const listDeploymentJobsBySiteSlug = (siteSlug: string, take = 20) =>
  db.deployment_jobs.findMany({
    where: { site_slug: siteSlug },
    orderBy: { created_at: 'desc' },
    take
  });

export const listDeploymentEvents = (deploymentJobId: string) =>
  db.deployment_job_events.findMany({
    where: { deployment_job_id: deploymentJobId },
    orderBy: { created_at: 'asc' }
  });

export const listSiteReleases = (siteSlug: string, domain: string, take = 10) =>
  db.site_releases.findMany({
    where: { site_slug: siteSlug, domain },
    orderBy: { created_at: 'desc' },
    take
  });
