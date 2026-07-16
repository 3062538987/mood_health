import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const DEFAULTS = Object.freeze({
  baseUrl: 'http://127.0.0.1:3000',
  warmups: 1,
  runs: 3,
  requests: 5,
  concurrency: 1,
  queryPath: '/health',
  output: 'docs/refactor/performance/R0-before.json',
  label: 'before',
  resourceProfile: 'host-unconstrained',
})

const optionNames = new Map([
  ['--base-url', 'baseUrl'],
  ['--warmups', 'warmups'],
  ['--runs', 'runs'],
  ['--requests', 'requests'],
  ['--concurrency', 'concurrency'],
  ['--query-path', 'queryPath'],
  ['--output', 'output'],
  ['--label', 'label'],
  ['--username', 'username'],
  ['--pid', 'pid'],
  ['--redis-pid', 'redisPid'],
  ['--sqlite-path', 'sqlitePath'],
  ['--resource-profile', 'resourceProfile'],
  ['--cpu-capacity', 'cpuCapacity'],
])

const numericOptions = new Set(['warmups', 'runs', 'requests', 'concurrency', 'pid', 'redisPid', 'cpuCapacity'])

export function parseArgs(argv) {
  const options = {
    ...DEFAULTS,
    username: process.env.PERF_USERNAME,
    password: process.env.PERF_PASSWORD,
  }

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const key = optionNames.get(flag)
    if (!key) throw new Error(`Unknown option: ${flag}`)
    const value = argv[index + 1]
    if (value === undefined) throw new Error(`Missing value for ${flag}`)
    options[key] = numericOptions.has(key) ? Number(value) : value
  }

  for (const key of ['warmups', 'runs', 'requests', 'concurrency']) {
    if (!Number.isInteger(options[key]) || options[key] <= 0) {
      throw new Error(`${key} must be a positive integer`)
    }
  }

  for (const key of ['pid', 'redisPid', 'cpuCapacity']) {
    if (options[key] !== undefined && (!Number.isInteger(options[key]) || options[key] <= 0)) {
      throw new Error(`${key} must be a positive integer`)
    }
  }

  return options
}

const round = (value) => Math.round(value * 100) / 100

const percentile = (values, ratio) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return round(sorted[index])
}

const summarizeValues = (values) => ({
  average: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
})

export function summarizeMeasurements(measurements) {
  const statusCounts = {}
  for (const measurement of measurements) {
    statusCounts[measurement.status] = (statusCounts[measurement.status] || 0) + 1
  }

  return {
    sampleCount: measurements.length,
    statusCounts,
    ttfbMs: summarizeValues(measurements.map((measurement) => measurement.ttfbMs)),
    totalMs: summarizeValues(measurements.map((measurement) => measurement.totalMs)),
  }
}

export function toRawMeasurements(measurements) {
  return measurements.map(({ status, ttfbMs, totalMs, error }) => ({
    status,
    ttfbMs,
    totalMs,
    ...(error ? { error } : {}),
  }))
}

const requestOnce = ({ url, method = 'GET', headers = {}, body }) =>
  new Promise((resolve) => {
    const target = new URL(url)
    const transport = target.protocol === 'https:' ? https : http
    const startedAt = performance.now()
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const request = transport.request(
      target,
      { method, headers, timeout: 10_000 },
      (response) => {
        const ttfbMs = performance.now() - startedAt
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          finish({
            status: response.statusCode || 0,
            ttfbMs: round(ttfbMs),
            totalMs: round(performance.now() - startedAt),
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      }
    )

    request.on('timeout', () => request.destroy(new Error('request timeout')))
    request.on('error', (error) => {
      finish({
        status: 0,
        ttfbMs: round(performance.now() - startedAt),
        totalMs: round(performance.now() - startedAt),
        error: error.message,
        body: '',
      })
    })
    if (body) request.write(body)
    request.end()
  })

const sampleWindowsProcess = (pid) => {
  const command = [
    `$p=Get-Process -Id ${pid} -ErrorAction Stop`,
    '[pscustomobject]@{cpuSeconds=$p.CPU;workingSetBytes=$p.WorkingSet64;peakWorkingSetBytes=$p.PeakWorkingSet64}|ConvertTo-Json -Compress',
  ].join(';')
  const output = execFileSync('powershell', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
  })
  return JSON.parse(output)
}

const sampleProcess = (pid) => {
  if (!pid) return null
  if (process.platform !== 'win32') {
    return { unsupported: `process sampling is not implemented for ${process.platform}` }
  }
  try {
    return sampleWindowsProcess(pid)
  } catch (error) {
    return { error: error.message }
  }
}

export const summarizeProcessWindow = (before, after, elapsedMs, cpuCapacity) => {
  if (!before || !after || before.error || after.error || before.unsupported || after.unsupported) {
    return { before, after, cpuPercent: null }
  }
  const cpuSeconds = Math.max(0, after.cpuSeconds - before.cpuSeconds)
  const memory = {
    averageWorkingSetBytes: Math.round((before.workingSetBytes + after.workingSetBytes) / 2),
    peakWorkingSetBytes: Math.max(before.peakWorkingSetBytes, after.peakWorkingSetBytes),
  }
  if (elapsedMs < 100) {
    return {
      cpuPercent: null,
      cpuNote: 'measurement window below 100ms',
      ...memory,
    }
  }
  return {
    cpuPercent: round((cpuSeconds / (elapsedMs / 1000) / cpuCapacity) * 100),
    ...memory,
  }
}

const runBatch = async (count, concurrency, createRequest) => {
  const measurements = new Array(count)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (nextIndex < count) {
      const index = nextIndex
      nextIndex += 1
      measurements[index] = await requestOnce(createRequest())
    }
  })
  await Promise.all(workers)
  return measurements
}

const runScenario = async (name, options, createRequest) => {
  await runBatch(options.warmups, options.concurrency, createRequest)
  const runs = []

  for (let run = 1; run <= options.runs; run += 1) {
    const processBefore = sampleProcess(options.pid)
    const startedAt = performance.now()
    const measurements = await runBatch(options.requests, options.concurrency, createRequest)
    const elapsedMs = performance.now() - startedAt
    const processAfter = sampleProcess(options.pid)
    runs.push({
      run,
      ...summarizeMeasurements(measurements),
      rawMeasurements: toRawMeasurements(measurements),
      process: summarizeProcessWindow(processBefore, processAfter, elapsedMs, options.cpuCapacity),
      errors: measurements.filter((measurement) => measurement.error).map((measurement) => measurement.error),
    })
  }

  return { name, status: 'measured', runs }
}

const collectSqliteMetadata = async (sqlitePath) => {
  if (!sqlitePath) return { status: 'not-configured' }
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const database = new DatabaseSync(sqlitePath, { readOnly: true })
    const tables = ['users', 'moods', 'questionnaires', 'user_assessments']
    const rowCounts = {}
    for (const table of tables) {
      const exists = database
        .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table)
      rowCounts[table] = exists ? Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count) : null
    }
    database.close()
    return { status: 'read-only-counts', path: sqlitePath, rowCounts }
  } catch (error) {
    return { status: 'unavailable', path: sqlitePath, error: error.message }
  }
}

const aggregateResourceRuns = (scenarios) => {
  const samples = scenarios
    .flatMap((scenario) => scenario.runs || [])
    .map((run) => run.process)
    .filter((sample) => sample && sample.cpuPercent !== null)
  if (!samples.length) return { status: 'unavailable' }
  return {
    status: 'measured',
    averageCpuPercent: round(samples.reduce((sum, sample) => sum + sample.cpuPercent, 0) / samples.length),
    peakCpuPercent: Math.max(...samples.map((sample) => sample.cpuPercent)),
    averageWorkingSetBytes: Math.round(
      samples.reduce((sum, sample) => sum + sample.averageWorkingSetBytes, 0) / samples.length
    ),
    peakWorkingSetBytes: Math.max(...samples.map((sample) => sample.peakWorkingSetBytes)),
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  options.cpuCapacity ||= os.cpus().length
  const jsonBody = options.username && options.password
    ? JSON.stringify({ username: options.username, password: options.password })
    : null
  const scenarios = []

  scenarios.push(
    await runScenario('homepage', options, () => ({ url: `${options.baseUrl}/` }))
  )

  if (!jsonBody) {
    scenarios.push({ name: 'login', status: 'skipped', reason: 'PERF_USERNAME/PERF_PASSWORD not provided' })
  } else {
    const loginRequest = () => ({
      url: `${options.baseUrl}/api/auth/login`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: jsonBody,
    })
    scenarios.push(await runScenario('login', options, loginRequest))
  }

  scenarios.push(
    await runScenario('representative-database-query', options, () => ({
      url: `${options.baseUrl}${options.queryPath}`,
    }))
  )

  const sqlite = await collectSqliteMetadata(options.sqlitePath)
  const document = {
    schemaVersion: 1,
    label: options.label,
    collectedAt: new Date().toISOString(),
    protocol: {
      baseUrl: options.baseUrl,
      warmupsPerScenario: options.warmups,
      independentRunsPerScenario: options.runs,
      requestsPerRun: options.requests,
      concurrency: options.concurrency,
      queryPath: options.queryPath,
      username: options.username || null,
      passwordStored: false,
      resourceProfile: options.resourceProfile,
      cpuCapacityUsedForCalculation: options.cpuCapacity,
    },
    environment: {
      platform: process.platform,
      release: os.release(),
      node: process.version,
      cpuModel: os.cpus()[0]?.model || null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    scenarios,
    resources: {
      nodeApi: aggregateResourceRuns(scenarios),
      database: {
        engine: 'SQLite (legacy baseline)',
        processAccounting: 'included in Node.js API process; SQLite has no separate process',
        queryNote: options.queryPath === '/health'
          ? 'The health query executes SELECT 1 + 1 and also checks Redis, so Redis timeout is part of this endpoint latency.'
          : null,
        metadata: sqlite,
      },
      redis: options.redisPid
        ? { pid: options.redisPid, sample: sampleProcess(options.redisPid) }
        : { status: 'not-running-or-not-configured' },
    },
    limitations: [
      'This raw file is evidence, not a performance-improvement claim.',
      'A before/after comparison is valid only when resource profile, data scale and protocol are identical.',
    ],
  }

  const outputPath = path.resolve(options.output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  console.log(`Performance baseline written to ${outputPath}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
