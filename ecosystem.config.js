module.exports = {
  apps: [
    {
      name: 'mycrm',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/mycrm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'telegram-bot',
      script: 'npx',
      args: 'tsx scripts/telegram-bot.ts',
      cwd: '/var/www/mycrm',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '150M',
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
