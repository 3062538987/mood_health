import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const PROCESS_NAME = 'mood-health-server'

test('ecosystem defines the canonical backend process name once', () => {
  const ecosystem = require('../mood_health_server/ecosystem.config.js')

  assert.deepEqual(ecosystem.apps.map((app) => app.name), [PROCESS_NAME])
  assert.equal(ecosystem.apps[0].instances, 1)
  assert.equal(ecosystem.apps[0].exec_mode, 'fork')
})

test('Windows and Linux launchers replace the canonical process before starting it', async () => {
  const [powershell, shell] = await Promise.all([
    readFile(new URL('../start-project.ps1', import.meta.url), 'utf8'),
    readFile(new URL('../start-project.sh', import.meta.url), 'utf8'),
  ])

  assert.match(powershell, /Remove-Pm2ProcessIfExists -Name 'mood-health-server'/)
  assert.match(powershell, /--only mood-health-server --update-env/)
  assert.match(shell, /delete mood-health-server/)
  assert.match(shell, /--only mood-health-server --update-env/)
})

test('npm PM2 commands only target project-owned process names', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.match(packageJson.scripts['pm2:stop'], /delete mood-health-server mood-ai-server/)
  assert.equal(packageJson.scripts['pm2:status'], 'node ./node_modules/pm2/bin/pm2 status')
})
