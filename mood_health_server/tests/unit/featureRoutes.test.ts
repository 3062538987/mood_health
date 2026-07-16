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

describe('enabled non-core feature routes', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.FEATURE_NON_CORE_MODULES_ENABLED = 'true'
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
  ])('is enabled for %s and returns a non-503 response', async (path) => {
    const response = await fetch(`${baseUrl}${path}`)

    // Routes are now enabled — should not return 503
    expect(response.status).not.toBe(503)
  })
})