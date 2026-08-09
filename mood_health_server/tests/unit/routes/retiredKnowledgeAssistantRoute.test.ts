import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import jwt from 'jsonwebtoken'

jest.mock('../../../src/config/mysql', () => ({
  checkMysqlHealth: jest.fn().mockResolvedValue(true),
  getMysqlPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([[], []]),
  })),
}))

jest.mock('../../../src/utils/redis.client', () => ({
  __esModule: true,
  default: { ping: jest.fn() },
}))

describe('retired knowledge assistant API', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
    process.env.JWT_SECRET = 'retired-route-test-secret'
    const { createApp } = await import('../../../src/app')
    server = createApp().listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    delete process.env.JWT_SECRET
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('does not expose the independent knowledge-assistant route', async () => {
    const token = jwt.sign(
      { userId: 7, username: 'student', role: 'student' },
      process.env.JWT_SECRET!
    )
    const response = await fetch(`${baseUrl}/api/knowledge-assistant/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
  })
})
