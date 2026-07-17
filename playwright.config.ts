import { defineConfig, devices } from '@playwright/test'

const backendPort = Number(process.env.E2E_BACKEND_PORT || 3100)
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3101)
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const backendUrl = `http://127.0.0.1:${backendPort}`
const noProxy = '127.0.0.1,localhost'

process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${noProxy}` : noProxy
process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${noProxy}` : noProxy
process.env.VITE_API_BASE_URL = backendUrl
process.env.FRONTEND_URL = frontendUrl

const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(backendPort),
  VITE_API_BASE_URL: backendUrl,
  FRONTEND_URL: frontendUrl,
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
  timeout: 30_000,
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
      command: 'npm --prefix mood_health_server run dev',
      url: `${backendUrl}/__e2e/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: e2eEnv,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
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
