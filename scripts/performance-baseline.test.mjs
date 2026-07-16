import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseArgs,
  summarizeMeasurements,
  summarizeProcessWindow,
  toRawMeasurements,
} from './performance-baseline.mjs'

test('summarizeMeasurements calculates average, p50 and p95', () => {
  const summary = summarizeMeasurements([
    { status: 200, ttfbMs: 10, totalMs: 20 },
    { status: 200, ttfbMs: 20, totalMs: 30 },
    { status: 500, ttfbMs: 30, totalMs: 40 },
  ])

  assert.deepEqual(summary.statusCounts, { 200: 2, 500: 1 })
  assert.equal(summary.ttfbMs.average, 20)
  assert.equal(summary.ttfbMs.p50, 20)
  assert.equal(summary.ttfbMs.p95, 30)
  assert.equal(summary.totalMs.average, 30)
})

test('parseArgs applies the fixed Phase A protocol defaults', () => {
  const options = parseArgs(['--base-url', 'http://127.0.0.1:3000'])

  assert.equal(options.baseUrl, 'http://127.0.0.1:3000')
  assert.equal(options.warmups, 1)
  assert.equal(options.runs, 3)
  assert.equal(options.requests, 5)
  assert.equal(options.concurrency, 1)
  assert.equal(options.queryPath, '/health')
})

test('parseArgs rejects non-positive protocol values', () => {
  assert.throws(() => parseArgs(['--runs', '0']), /runs must be a positive integer/)
})

test('toRawMeasurements keeps recomputable timings without response bodies', () => {
  const raw = toRawMeasurements([
    { status: 401, ttfbMs: 1.2, totalMs: 1.5, body: '{"token":"secret"}', error: undefined },
  ])

  assert.deepEqual(raw, [{ status: 401, ttfbMs: 1.2, totalMs: 1.5 }])
  assert.equal('body' in raw[0], false)
})

test('summarizeProcessWindow rejects CPU percentages from sub-100ms windows', () => {
  const summary = summarizeProcessWindow(
    { cpuSeconds: 10, workingSetBytes: 100, peakWorkingSetBytes: 200 },
    { cpuSeconds: 10.01, workingSetBytes: 120, peakWorkingSetBytes: 220 },
    50,
    2
  )

  assert.equal(summary.cpuPercent, null)
  assert.equal(summary.cpuNote, 'measurement window below 100ms')
  assert.equal(summary.averageWorkingSetBytes, 110)
})
