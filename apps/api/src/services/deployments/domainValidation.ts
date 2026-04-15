import { DEPLOYMENT_CONFIG } from '../../config/deployment';

const domainPattern = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export const normalizeDomain = (domain: string) => String(domain || '').trim().toLowerCase();

export const validateDomainFormat = (domain: string) => domainPattern.test(normalizeDomain(domain));

export const isAuthorizedDomain = (domain: string, allowlist: string[]) => {
  if (allowlist.length === 0) return true;
  const normalized = normalizeDomain(domain);
  return allowlist.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
};

export const assertDomainAllowed = (domain: string) => {
  const normalized = normalizeDomain(domain);
  if (!validateDomainFormat(normalized)) {
    throw new Error('Invalid domain format');
  }
  if (!isAuthorizedDomain(normalized, DEPLOYMENT_CONFIG.allowedDomainSuffixes)) {
    throw new Error('Domain is not allowed for deployment');
  }
  return normalized;
};
