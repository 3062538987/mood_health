import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载 mood_health_server 的 .env 文件以获取数据库等配置
dotenv.config({ path: path.resolve(__dirname, 'mood_health_server/.env') })

const backendPort = Number(process.env.E2E_BACKEND_PORT || 3100)
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3101)
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const backendUrl = `http://127.0.0.1:${backendPort}`
const noProxy = '127.0.0.1,localhost'

// E2E MySQL 固定使用 3316（Docker 容器 mood-health-e2e-fullreview-mysql-1 的主机映射端口）
process.env.MYSQL_PORT = process.env.E2E_MYSQL_PORT || '3316'
// globalSetup 需要这些环境变量来运行种子数据（后端 .env 中 ALLOW_DEMO_SEED=false）
// 强制覆盖：dotenv 已加载后端 .env（DEMO_PASSWORD=123456），E2E 需要统一密码
process.env.ALLOW_DEMO_SEED = 'true'
process.env.DEMO_PASSWORD = 'E2eDemoPass123!'
process.env.E2E_USERNAME = 'demo_student'
process.env.E2E_PASSWORD = 'E2eDemoPass123!'
console.log('[DEBUG] E2E_MYSQL_PORT:', process.env.E2E_MYSQL_PORT, 'MYSQL_PORT:', process.env.MYSQL_PORT)

process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${noProxy}` : noProxy
process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${noProxy}` : noProxy
// 前端通过 Vite proxy 访问 /api，不直接指向 backendUrl，避免跨域 cookie/CSRF 问题
process.env.FRONTEND_URL = frontendUrl

const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(backendPort),
  E2E_BACKEND_PORT: String(backendPort),
  E2E_FRONTEND_PORT: String(frontendPort),
  FRONTEND_URL: frontendUrl,
  MYSQL_PORT: process.env.E2E_MYSQL_PORT || '3316',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'mood_health_e2e',
  ALLOW_DEMO_SEED: 'true',
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'E2eDemoPass123!',
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-jwt-secret-for-local-playwright-only',
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  REDIS_REQUIRED: 'false',
  NO_PROXY: process.env.NO_PROXY,
  no_proxy: process.env.no_proxy,
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 5_000,
  },
  retries: 0,
  outputDir: 'test-results/e2e-artifacts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: [
    {
      command:
        process.platform === 'win32'
          ? 'cmd /c tests\\e2e\\scripts\\start-backend.bat'
          : 'node mood_health_server/dist/server.js',
      url: `${backendUrl}/__e2e/ready`,
      reuseExistingServer: process.env.E2E_REUSE_SERVER !== 'false',
      timeout: 120_000,
      env: e2eEnv,
    },
    {
      command: `npx vite --port ${frontendPort} --strictPort -c vite.e2e.config.ts --mode e2e`,
      url: frontendUrl,
      reuseExistingServer: process.env.E2E_REUSE_SERVER !== 'false',
      timeout: 120_000,
      env: e2eEnv,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
