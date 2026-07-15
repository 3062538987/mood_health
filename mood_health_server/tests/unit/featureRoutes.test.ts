import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

jest.mock('../../src/config/mysql', () => ({
  checkMysqlHealth: jest.fn().mockResolvedValue(true),
  getMysqlPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([[], []]),
  })),
}))

jest.mock('../../src/utils/redis.client', () => ({
  __esModule: true,
  default: { ping: jest.fn() },
}))

for (const routeModule of [
  '../../src/routes/activityRoutes',
  '../../src/routes/postRoutes',
  '../../src/routes/musicRoutes',
  '../../src/routes/courseRoutes',
  '../../src/routes/relaxRoutes',
  '../../src/routes/achievementRoutes',
]) {
  jest.mock(routeModule, () => {
    throw new Error(`disabled route module was imported: ${routeModule}`)
  })
}

describe('disabled backend feature routes', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.FEATURE_NON_CORE_MODULES_ENABLED = 'false'
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
    const { createApp } = await import('../../src/app')
    server = createApp().listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    delete process.env.FEATURE_NON_CORE_MODULES_ENABLED
    if (!server) {
      return
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it.each([
    '/api/activities',
    '/api/posts',
    '/api/music',
    '/api/courses',
    '/api/relax',
    '/api/achievements',
  ])('returns the unified disabled response for %s without querying SQLite', async (path) => {
    const response = await fetch(`${baseUrl}${path}`)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      code: 1403,
      message: '功能未启用',
      data: null,
    })
  })
})
