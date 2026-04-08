#!/usr/bin/env node
import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'

function startProcess(name, args) {
  const child = isWin
    ? spawn('cmd.exe', ['/d', '/s', '/c', ['npm', ...args].join(' ')], {
        stdio: 'inherit',
      })
    : spawn('npm', args, {
        stdio: 'inherit',
        shell: false,
      })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited by signal: ${signal}`)
      return
    }
    console.log(`[${name}] exited with code: ${code ?? 0}`)
  })

  child.on('error', (err) => {
    console.error(`[${name}] failed to start: ${err.message}`)
  })

  return child
}

console.log('Starting frontend and backend dev servers...')

const frontend = startProcess('frontend', ['run', 'dev'])
const backend = startProcess('backend', ['--prefix', 'mood_health_server', 'run', 'dev'])

let stopping = false
function shutdown(signal) {
  if (stopping) return
  stopping = true

  console.log(`Received ${signal}, stopping child processes...`)

  for (const proc of [frontend, backend]) {
    if (!proc.killed) {
      proc.kill('SIGINT')
    }
  }

  setTimeout(() => process.exit(0), 500)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
