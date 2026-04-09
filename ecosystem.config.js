module.exports = {
  apps: [
    {
      name: 'api',
      cwd: '/projects/apps/api',
      script: 'npm',
      args: 'run start',
      max_memory_restart: '1G',
      env: { PORT: 5000 }
    },
    {
      name: 'super-admin',
      cwd: '/projects/apps/super-admin',
      script: 'npm',
      args: 'run start -- -p 4000',
      max_memory_restart: '1G'
    },
    {
      name: 'per-site-admin',
      cwd: '/projects/apps/per-site-admin',
      script: 'npm',
      args: 'run start -- -p 4001',
      max_memory_restart: '1G'
    },
    {
      name: 'site-demo',
      cwd: '/projects/apps/site-demo',
      script: 'npm',
      args: 'run start -- -p 3001',
      max_memory_restart: '1G'
    }
  ]
};
