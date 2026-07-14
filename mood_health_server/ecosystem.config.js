module.exports = {
  apps: [
    {
      name: 'mood-health-server',
      cwd: __dirname,
      script: 'dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      min_uptime: '10s',
      out_file: './logs/pm2-node-out.log',
      error_file: './logs/pm2-node-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOST: '127.0.0.1',
        FRONTEND_URL: 'http://localhost:5173,http://localhost:3001',
      },
    },
  ],
}
