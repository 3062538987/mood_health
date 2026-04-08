#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const backendRoot = path.join(root, 'mood_health_server')

const runAll = process.argv.includes('--all')
const passwordArg = process.argv.find((arg) => arg.startsWith('--password='))
const password = passwordArg
  ? passwordArg.slice('--password='.length)
  : process.env.DEMO_USER_PASSWORD || '123456'

const target = runAll ? 'seed:demo:all' : 'seed:demo'

console.log(`Initializing demo data with script: ${target}`)
console.log(`Backend path: ${backendRoot}`)

const result = spawnSync('npm', ['--prefix', backendRoot, 'run', target, '--', password], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
