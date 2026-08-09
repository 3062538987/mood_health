import { spawn } from 'node:child_process'
import fs from 'node:fs'

const e2eEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3100',
  VITE_API_BASE_URL: 'http://127.0.0.1:3100',
  FRONTEND_URL: 'http://127.0.0.1:3101',
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: '3316',
  MYSQL_DATABASE: 'mood_health_e2e',
  MYSQL_APP_USER: 'mood_app',
  MYSQL_APP_PASSWORD: 'Jyf350721$',
  MYSQL_MIGRATOR_USER: 'mood_app',
  MYSQL_MIGRATOR_PASSWORD: 'Jyf350721$',
  REDIS_REQUIRED: 'false',
  ALLOW_DEMO_SEED: 'true',
  DEMO_PASSWORD: 'E2eDemoPass123!',
  JWT_SECRET: 'e2e-jwt-secret-for-local-playwright-only',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
}

const log = fs.createWriteStream('.tmp-spawn-test.log')
const child = spawn('cmd.exe', ['/c', 'node mood_health_server/dist/server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, ...e2eEnv },
})

child.stdout.pipe(log)
child.stderr.pipe(log)

child.on('exit', (code) => {
  log.write(`\nEXIT CODE: ${code}\n`)
  log.end()
  console.log('exit code:', code)
})

setTimeout(() => {
  child.kill()
}, 10000)
