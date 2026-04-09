const path = require('path');

const appPath = (relativePath) => path.join(__dirname, relativePath);

module.exports = {
  apps: [
    {
      name: 'api',
      cwd: appPath('apps/api'),
      script: 'npm',
      args: 'run start',
      max_memory_restart: '1G',
      env: { PORT: 5000 }
    },
    {
      name: 'super-admin',
      cwd: appPath('apps/super-admin'),
      script: 'npm',
      args: 'run start -- -p 4000',
      max_memory_restart: '1G'
    },
    {
      name: 'per-site-admin',
      cwd: appPath('apps/per-site-admin'),
      script: 'npm',
      args: 'run start -- -p 4001',
      max_memory_restart: '1G'
    },
    {
      name: 'site-demo',
      cwd: appPath('apps/site-demo'),
      script: 'npm',
      args: 'run start -- -p 3001',
      max_memory_restart: '1G'
    }
  ]
};
