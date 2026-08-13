import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readLaunchers = async () =>
  Promise.all([
    readFile(new URL('../启动大学生情绪健康管理平台.bat', import.meta.url), 'utf8'),
    readFile(new URL('../start-project.ps1', import.meta.url), 'utf8'),
  ])

test('one-click launcher delegates infrastructure preparation to PowerShell', async () => {
  const [batch] = await readLaunchers()

  assert.match(batch, /start-project\.ps1" -WithAi -PrepareInfrastructure/)
  assert.doesNotMatch(batch, /docker info/)
  assert.doesNotMatch(batch, /port 3316 is still not ready/i)
})

test('PowerShell launcher starts Docker Desktop and isolates this checkout', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /docker desktop start --timeout 120/)
  assert.match(powershell, /mood-health-ccooddee/)
  assert.match(powershell, /Get-AvailableTcpPort -PreferredPort 3316/)
  assert.match(powershell, /Get-AvailableTcpPort -PreferredPort 6379/)
  assert.match(powershell, /function Stop-StaleWorkspaceServices/)
  assert.match(powershell, /CommandLine\.IndexOf\(\$Root/)
  assert.match(powershell, /taskkill\.exe \/PID \$_\.Id \/T \/F/)
  assert.match(powershell, /MoodHealth - FastAPI AI/)
  assert.match(powershell, /taskkill\.exe \/PID \$wrapper\.ProcessId \/T \/F/)
})

test('selected infrastructure settings are shared by migrations and services', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /\$env:MYSQL_PORT = \[string\]\$mysqlPort/)
  assert.match(powershell, /\$env:REDIS_PORT = \[string\]\$redisPort/)
  assert.match(powershell, /npm --prefix mood_health_server run db:migrate/)
  assert.match(powershell, /\$env:MYSQL_USER = \$env:MYSQL_APP_USER/)
  assert.match(powershell, /\$env:MYSQL_PASSWORD = \$env:MYSQL_APP_PASSWORD/)
  assert.match(powershell, /\$env:AI_SERVICE_INTERNAL_TOKEN/)
})

test('PowerShell seeds required reference data after migrations', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /npm --prefix mood_health_server run db:seed:reference/)

  const migration = powershell.indexOf('npm --prefix mood_health_server run db:migrate')
  const referenceSeed = powershell.indexOf('npm --prefix mood_health_server run db:seed:reference')
  assert.ok(migration >= 0 && migration < referenceSeed)
})

test('PowerShell seeds demo accounts only when explicitly enabled', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /mood_health_server\\\.env/)
  assert.match(powershell, /ALLOW_DEMO_SEED/)
  assert.match(powershell, /npm --prefix mood_health_server run db:seed:demo/)

  const referenceSeed = powershell.indexOf('npm --prefix mood_health_server run db:seed:reference')
  const demoSeed = powershell.indexOf('npm --prefix mood_health_server run db:seed:demo')
  assert.ok(referenceSeed >= 0 && referenceSeed < demoSeed)
})

test('repeated launches reuse this checkout existing container ports', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /Get-ComposePublishedPort -Service 'mysql' -ContainerPort 3306/)
  assert.match(powershell, /Get-ComposePublishedPort -Service 'redis' -ContainerPort 6379/)
})

test('PowerShell waits for all application services before returning', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /function Wait-ServiceEndpoint/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{NodePort\}\/health/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{AiPort\}\/api\/health\/ready/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{FrontendPort\}\//)
  assert.match(powershell, /Timed out waiting for \$Name/)
  assert.match(powershell, /embedding model or vector index/i)
  assert.doesNotMatch(powershell, /streamlit|8501/i)
})

test('batch launcher opens the browser without a fixed readiness delay', async () => {
  const [batch] = await readLaunchers()

  assert.doesNotMatch(batch, /timeout \/t/i)
  assert.match(batch, /start "" "http:\/\/localhost:3001"/)
})

test('batch launcher bootstraps an isolated Python 3.11 environment through the setup script', async () => {
  const [batch] = await readLaunchers()

  assert.match(batch, /set "PYTHONUTF8=1"/)
  assert.match(batch, /set "AI_DIR=%ROOT%mood_health_ai_service"/)
  assert.match(batch, /set "AI_VENV=%AI_DIR%\\\.venv"/)
  assert.match(batch, /sys\.version_info\[:2\] == \(3, 11\)/)
  assert.match(batch, /npm run setup:python/)

  const forceUtf8 = batch.indexOf('set "PYTHONUTF8=1"')
  const setupPython = batch.indexOf('npm run setup:python')
  const startProject = batch.indexOf('start-project.ps1')
  assert.ok(forceUtf8 >= 0 && forceUtf8 < setupPython)
  assert.ok(setupPython >= 0 && setupPython < startProject)
})

test('PowerShell reconciles persistent MySQL app credentials before migration', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /function Sync-MySqlAppCredentials/)
  assert.match(powershell, /CREATE USER IF NOT EXISTS/)
  assert.match(powershell, /ALTER USER/)
  assert.match(powershell, /mysql --protocol=socket --user=root --batch --execute="/)
  assert.doesNotMatch(powershell, /<<SQL/)
  assert.match(
    powershell,
    /\$syncScript \| & docker compose -p mood-health-ccooddee exec -T mysql sh -s/
  )

  const composeUp = powershell.indexOf('docker compose -p mood-health-ccooddee up')
  const syncCall = powershell.lastIndexOf('Sync-MySqlAppCredentials')
  const migration = powershell.indexOf('npm --prefix mood_health_server run db:migrate')

  assert.ok(composeUp < syncCall && syncCall < migration)
})
