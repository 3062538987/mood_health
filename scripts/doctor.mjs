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
  checkFile('mood-health-server/package.json', true)
  checkFile('.env', false)
  checkFile('mood-health-server/.env', false)
  checkDir('node_modules', false)
  checkDir('mood-health-server/node_modules', false)
  checkFile('mood-health-server/dist/app.js', false)
  checkFile('start-project.ps1', true)

  const ports = [
    { name: 'Frontend dev', port: 3001 },
    { name: 'Node API', port: 3000 },
    { name: 'AI API', port: 8000 },
    { name: 'Redis', port: 6379 },
  ]

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
