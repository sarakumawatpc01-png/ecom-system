export const DEPLOYMENT_CONFIG = {
  uploadDir: process.env.DEPLOYMENT_UPLOAD_DIR || '/tmp/ecom-deployments/uploads',
  workspaceDir: process.env.DEPLOYMENT_WORKSPACE_DIR || '/tmp/ecom-deployments/workspaces',
  releasesDir: process.env.DEPLOYMENT_RELEASES_DIR || '/tmp/ecom-deployments/releases',
  nginxOutputDir: process.env.DEPLOYMENT_NGINX_OUTPUT_DIR || '/tmp/ecom-deployments/nginx',
  maxCompressedBytes: Number(process.env.DEPLOYMENT_MAX_COMPRESSED_BYTES || 200 * 1024 * 1024),
  maxExtractedBytes: Number(process.env.DEPLOYMENT_MAX_EXTRACTED_BYTES || 600 * 1024 * 1024),
  maxFileCount: Number(process.env.DEPLOYMENT_MAX_FILE_COUNT || 15000),
  maxBuildSeconds: Number(process.env.DEPLOYMENT_MAX_BUILD_SECONDS || 900),
  maxHealthRetries: Number(process.env.DEPLOYMENT_MAX_HEALTH_RETRIES || 5),
  keepReleaseCount: Number(process.env.DEPLOYMENT_KEEP_RELEASE_COUNT || 5),
  internalHealthPath: process.env.DEPLOYMENT_INTERNAL_HEALTH_PATH || '/api/health',
  externalHealthPath: process.env.DEPLOYMENT_EXTERNAL_HEALTH_PATH || '/',
  simulateInfraChanges: process.env.DEPLOYMENT_SIMULATE_INFRA_CHANGES !== 'false',
  malwareScannerCommand: process.env.DEPLOYMENT_MALWARE_SCAN_COMMAND || '',
  malwareScannerArgs: (process.env.DEPLOYMENT_MALWARE_SCAN_ARGS || '--no-summary {file}')
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean),
  allowedDomainSuffixes: (process.env.DEPLOYMENT_ALLOWED_DOMAIN_SUFFIXES || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  csrfToken: process.env.SUPER_ADMIN_CSRF_TOKEN || ''
} as const;

export const DEPLOYMENT_PHASES = [
  'queued',
  'validate_input',
  'zip_security',
  'extract_workspace',
  'validate_structure',
  'prepare_runtime',
  'build_site',
  'deploy_artifact',
  'configure_nginx',
  'provision_ssl',
  'health_checks',
  'finalize',
  'rollback'
] as const;

export const DEPLOYMENT_STATUSES = ['queued', 'running', 'success', 'failed', 'rolled_back'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];
export type DeploymentPhase = (typeof DEPLOYMENT_PHASES)[number];
