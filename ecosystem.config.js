const path = require('path');

const appPath = (relativePath) => path.join(__dirname, relativePath);
const logPath = (name) => appPath(`logs/${name}.log`);

module.exports = {
  apps: [
    {
      name: 'api',
      cwd: appPath('apps/api'),
      script: 'npm',
      args: 'run start',
      max_memory_restart: '1G',
      env: { PORT: 5000 },
      out_file: logPath('api-out'),
      error_file: logPath('api-error'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'super-admin',
      cwd: appPath('apps/super-admin'),
      script: 'npm',
      args: 'run start -- -p 4000',
      max_memory_restart: '1G',
      out_file: logPath('super-admin-out'),
      error_file: logPath('super-admin-error'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'per-site-admin',
      cwd: appPath('apps/per-site-admin'),
      script: 'npm',
      args: 'run start -- -p 4001',
      max_memory_restart: '1G',
      out_file: logPath('per-site-admin-out'),
      error_file: logPath('per-site-admin-error'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'site-demo',
      cwd: appPath('apps/site-demo'),
      script: 'npm',
      args: 'run start -- -p 3001',
      max_memory_restart: '1G',
      out_file: logPath('site-demo-out'),
      error_file: logPath('site-demo-error'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10
    }
  ]
};
