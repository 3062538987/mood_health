/**
 * PM2 进程管理配置 — 管理 Node 后端 + FastAPI AI 服务。
 * 使用: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      // Node 后端服务
      name: 'mood-health-node',
      script: 'npm',
      args: 'run start',
      cwd: './mood_health_server',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        AI_SERVICE_BASE_URL: 'http://127.0.0.1:8001',
        FASTAPI_BASE_URL: 'http://127.0.0.1:8001',
      },
      // 健康检查: Node 自身的 /api/health
      health_check: {
        type: 'http',
        url: 'http://127.0.0.1:3000/api/health',
        interval: 30000,
      },
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      error_file: './logs/node-error.log',
      out_file: './logs/node-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // FastAPI AI 情绪分析服务
      name: 'mood-health-fastapi',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8001',
      cwd: './mood_health_ai_service',
      interpreter: 'none', // uvicorn 是独立可执行文件
      env: {
        MOOD_AI_SERVICE_PORT: '8001',
      },
      // 健康检查: FastAPI /api/health
      health_check: {
        type: 'http',
        url: 'http://127.0.0.1:8001/api/health',
        interval: 30000,
      },
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      error_file: './logs/fastapi-error.log',
      out_file: './logs/fastapi-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
