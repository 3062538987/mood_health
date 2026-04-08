#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const strict = process.argv.includes('--strict')

let warnings = 0
let errors = 0

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }
  const normalized = String(value).trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function readEnvFromFile(relPath) {
  const absPath = path.join(root, relPath)
  if (!fs.existsSync(absPath)) {
    return {}
  }

  const content = fs.readFileSync(absPath, 'utf8')
  const env = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }
    const eqIndex = trimmed.indexOf('=')
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (key) {
      env[key] = value
    }
  }

  return env
}

function ok(msg) {
  console.log(`[OK] ${msg}`)
}

function warn(msg) {
  warnings += 1
  console.log(`[WARN] ${msg}`)
}

function fail(msg) {
  errors += 1
  console.log(`[ERROR] ${msg}`)
}

function checkFile(relPath, required = false) {
  const absPath = path.join(root, relPath)
  if (fs.existsSync(absPath)) {
    ok(`Found ${relPath}`)
    return true
  }
  if (required) {
    fail(`Missing required file: ${relPath}`)
  } else {
    warn(`Missing optional file: ${relPath}`)
  }
  return false
}

function checkDir(relPath, required = false) {
  const absPath = path.join(root, relPath)
  if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
    ok(`Found directory ${relPath}`)
    return true
  }
  if (required) {
    fail(`Missing required directory: ${relPath}`)
  } else {
    warn(`Missing optional directory: ${relPath}`)
  }
  return false
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath))
}

function checkCommand(binary, args, required = true) {
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${binary} ${args.join(' ')}`], {
          encoding: 'utf8',
        })
      : spawnSync(binary, args, {
          encoding: 'utf8',
        })

  if (result.error || result.status !== 0) {
    const detail = result.error ? result.error.message : (result.stderr || '').trim()
    if (required) {
      fail(`${binary} not available (${detail || 'unknown error'})`)
    } else {
      warn(`${binary} not available (${detail || 'unknown error'})`)
    }
    return false
  }

  const output = (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] || 'available'
  ok(`${binary} ${output}`)
  return true
}

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeoutMs = 700

    const done = (status) => {
      socket.destroy()
      resolve(status)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done('open'))
    socket.once('timeout', () => done('closed'))
    socket.once('error', () => done('closed'))
    socket.connect(port, host)
  })
}

async function run() {
  console.log('Mood Health Doctor')
  console.log('==================')

  checkCommand('node', ['--version'], true)
  checkCommand('npm', ['--version'], true)
  checkCommand('python', ['--version'], false)
  checkCommand('pm2', ['--version'], false)

  checkFile('package.json', true)
  checkFile('mood_health_server/package.json', true)
  checkFile('.env', false)
  checkFile('mood_health_server/.env', false)
  checkDir('node_modules', false)
  checkDir('mood_health_server/node_modules', false)
  checkFile('mood_health_server/dist/app.js', false)
  if (process.platform === 'win32') {
    checkFile('start-project.ps1', true)
    checkFile('start-project.sh', false)
  } else {
    checkFile('start-project.sh', true)
    checkFile('start-project.ps1', false)
  }

  if (!fileExists('start-project.ps1') && !fileExists('start-project.sh')) {
    fail('Missing startup scripts: start-project.ps1/start-project.sh')
  }

  const backendEnv = readEnvFromFile('mood_health_server/.env')
  const redisRequired = parseBoolean(process.env.REDIS_REQUIRED ?? backendEnv.REDIS_REQUIRED, false)

  const ports = [
    { name: 'Frontend dev', port: 3001 },
    { name: 'Node API', port: 3000 },
  ]

  if (redisRequired) {
    ports.push({ name: 'Redis', port: 6379 })
  } else {
    ok('Redis port check skipped (REDIS_REQUIRED=false)')
  }

  for (const item of ports) {
    const status = await checkPort('127.0.0.1', item.port)
    if (status === 'open') {
      ok(`${item.name} port ${item.port} is reachable`)
    } else {
      warn(`${item.name} port ${item.port} is not reachable`)
    }
  }

  console.log('')
  console.log(`Summary: ${errors} error(s), ${warnings} warning(s)`)

  if (errors > 0 || (strict && warnings > 0)) {
    process.exit(1)
  }
}

run().catch((err) => {
  fail(`Unexpected failure: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
