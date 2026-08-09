import express, { Express } from 'express'
import { AddressInfo } from 'net'
import { Server } from 'http'

import counselingRouter from '../../../src/routes/counselingRoutes'
import {
  getSessionMessagesHandler,
  renameSessionHandler,
  sessionCounselingHandler,
} from '../../../src/controllers/counselingController'

jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

jest.mock('../../../src/controllers/counselingController', () => ({
  sessionCounselingHandler: jest.fn((_req, res) => res.status(200).json({ ok: true })),
  getSessionsHandler: jest.fn((_req, res) => res.status(200).json({ ok: true })),
  getSessionMessagesHandler: jest.fn((_req, res) => res.status(200).json({ ok: true })),
  createSessionHandler: jest.fn((_req, res) => res.status(200).json({ ok: true })),
  renameSessionHandler: jest.fn((_req, res) => res.status(200).json({ ok: true })),
}))

const sessionCounselingHandlerMock = jest.mocked(sessionCounselingHandler)
const getSessionMessagesHandlerMock = jest.mocked(getSessionMessagesHandler)
const renameSessionHandlerMock = jest.mocked(renameSessionHandler)

describe('counseling request validation routes', () => {
  let app: Express
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    app = express()
    app.use(express.json())
    app.use('/api/counseling', counselingRouter)
    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    })
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}/api/counseling`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [{ message: '   ' }],
    [{ message: 'a'.repeat(1001) }],
    [{ message: 42 }],
    [{ message: 'hello', sessionId: 'not-a-uuid' }],
    [{ message: 'hello', allowWebSearch: 'true' }],
  ])('rejects invalid send payload %p before the controller', async (body) => {
    const response = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      code: 1001,
      data: expect.objectContaining({ errors: expect.any(Array) }),
    }))
    expect(sessionCounselingHandlerMock).not.toHaveBeenCalled()
  })

  it('allows a valid send payload to reach the controller', async () => {
    const response = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: ' hello ',
        sessionId: '14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19',
        allowWebSearch: true,
      }),
    })

    expect(response.status).toBe(200)
    expect(sessionCounselingHandlerMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['GET', '/sessions/not-a-uuid'],
    ['PATCH', '/sessions/not-a-uuid'],
  ])('rejects non-UUID session path parameters for %s %s', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'PATCH' ? JSON.stringify({ title: 'updated title' }) : undefined,
    })

    expect(response.status).toBe(400)
    expect(getSessionMessagesHandlerMock).not.toHaveBeenCalled()
    expect(renameSessionHandlerMock).not.toHaveBeenCalled()
  })

  it.each([undefined, '', '   ', 'a'.repeat(31)])(
    'rejects invalid renamed title %p before the controller',
    async (title) => {
      const response = await fetch(`${baseUrl}/sessions/14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      expect(response.status).toBe(400)
      expect(renameSessionHandlerMock).not.toHaveBeenCalled()
    }
  )
})
