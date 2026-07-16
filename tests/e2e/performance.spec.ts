import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type Request, type Response } from '@playwright/test'

type RequestSummary = {
  method: string
  url: string
  count: number
  statuses: number[]
}

type BrowserPerformanceEvidence = {
  generatedAt: string
  baseUrl: string
  homeLoadEventEndMs: number[]
  homeLoadEventEndMedianMs: number
  longTasksMs: number[]
  maxLongTaskMs: number
  heapSamplesBytes: number[]
  repeatedRequests: RequestSummary[]
}

const evidencePath = path.resolve('tasks/evidence/test3-browser-performance-final.json')
const maxHomeLoadMedianMs = 1500
const maxLongTaskMs = 100

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the performance acceptance test`)
  return value
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const readLongTasks = async (page: Page): Promise<number[]> =>
  page.evaluate(() => ((window as unknown as { __longTasks?: number[] }).__longTasks ?? []).slice())

const readHeap = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
    return perf.memory?.usedJSHeapSize ?? 0
  })

const addLongTaskObserver = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    ;(window as unknown as { __longTasks: number[] }).__longTasks = []
    const PerformanceObserverCtor = window.PerformanceObserver
    if (!PerformanceObserverCtor) return

    try {
      const observer = new PerformanceObserverCtor((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 50) {
            ;(window as unknown as { __longTasks: number[] }).__longTasks.push(Math.round(entry.duration))
          }
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      // Older Chromium builds may not expose longtask in all contexts.
    }
  })
}

const trackRequests = (page: Page): Map<string, RequestSummary> => {
  const requests = new Map<string, RequestSummary>()
  const requestIds = new Map<Request, string>()

  page.on('request', (request) => {
    const key = `${request.method()} ${request.url()}`
    requestIds.set(request, key)
    const existing = requests.get(key)
    if (existing) {
      existing.count += 1
      return
    }
    requests.set(key, {
      method: request.method(),
      url: request.url(),
      count: 1,
      statuses: [],
    })
  })

  page.on('response', (response: Response) => {
    const key = requestIds.get(response.request())
    if (!key) return
    const summary = requests.get(key)
    if (summary) summary.statuses.push(response.status())
  })

  return requests
}

test('production browser performance stays inside the P2-3 acceptance envelope', async ({ browser, baseURL }) => {
  const username = requireEnv('E2E_USERNAME')
  const password = requireEnv('E2E_PASSWORD')
  const homeLoadEventEndMs: number[] = []
  const allLongTasks: number[] = []
  const heapSamplesBytes: number[] = []
  const repeatedRequests: RequestSummary[] = []

  for (let index = 0; index < 3; index += 1) {
    const page = await browser.newPage()
    await addLongTaskObserver(page)
    const requests = trackRequests(page)

    await page.goto(baseURL ?? '/', { waitUntil: 'load' })
    const loadEventEnd = await page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      return Math.round(navigation?.loadEventEnd ?? 0)
    })
    homeLoadEventEndMs.push(loadEventEnd)
    allLongTasks.push(...(await readLongTasks(page)))
    repeatedRequests.push(...[...requests.values()].filter((request) => request.count > 1))
    await page.close()
  }

  const page = await browser.newPage()
  await addLongTaskObserver(page)
  const authenticatedRequests = trackRequests(page)

  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login$/)

  for (let index = 0; index < 8; index += 1) {
    await page.goto('/user/profile', { waitUntil: 'networkidle' })
    heapSamplesBytes.push(await readHeap(page))
    await page.goto('/mood/record', { waitUntil: 'networkidle' })
    heapSamplesBytes.push(await readHeap(page))
  }

  allLongTasks.push(...(await readLongTasks(page)))
  repeatedRequests.push(...[...authenticatedRequests.values()].filter((request) => request.count > 1))
  await page.close()

  const maxObservedLongTaskMs = Math.max(0, ...allLongTasks)
  const evidence: BrowserPerformanceEvidence = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseURL ?? 'http://127.0.0.1:4173',
    homeLoadEventEndMs,
    homeLoadEventEndMedianMs: median(homeLoadEventEndMs),
    longTasksMs: allLongTasks,
    maxLongTaskMs: maxObservedLongTaskMs,
    heapSamplesBytes,
    repeatedRequests,
  }

  fs.mkdirSync(path.dirname(evidencePath), { recursive: true })
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)

  expect(evidence.homeLoadEventEndMedianMs).toBeLessThanOrEqual(maxHomeLoadMedianMs)
  expect(maxObservedLongTaskMs).toBeLessThan(maxLongTaskMs)
  expect(repeatedRequests).toEqual([])
  expect(heapSamplesBytes.every((sample) => Number.isFinite(sample))).toBe(true)
})
