import { Response } from 'express'
import {
  renameSessionHandler,
} from '../../../src/controllers/counselingController'
import { AuthRequest } from '../../../src/middleware/auth'
import { renameSession } from '../../../src/services/counselingSessionService'

jest.mock('../../../src/services/counselingSessionService', () => ({
  saveMessagePair: jest.fn(),
  loadSession: jest.fn(),
  listSessions: jest.fn(),
  buildContextMessages: jest.fn(),
  generateSessionId: jest.fn(),
  renameSession: jest.fn(),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

const renameSessionMock = jest.mocked(renameSession)

describe('counseling session rename controller', () => {
  let req: Partial<AuthRequest>
  let res: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    renameSessionMock.mockReset()
    jsonMock = jest.fn().mockReturnThis()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })
    res = { status: statusMock, json: jsonMock }
    req = {
      user: { userId: 7, username: 'student', role: 'student' } as any,
      params: { sessionId: 's1' },
      body: {},
    }
  })

  it('trims and saves a valid title', async () => {
    renameSessionMock.mockResolvedValue(true)
    req.body = { title: '  睡眠调整计划  ' }

    await renameSessionHandler(req as AuthRequest, res as Response)

    expect(renameSessionMock).toHaveBeenCalledWith(7, 's1', '睡眠调整计划')
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 0,
      data: { sessionId: 's1', title: '睡眠调整计划' },
    }))
  })

  it.each([undefined, '', '   ', 'a'.repeat(31)])(
    'rejects invalid title %p',
    async title => {
      req.body = { title }

      await renameSessionHandler(req as AuthRequest, res as Response)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(renameSessionMock).not.toHaveBeenCalled()
    }
  )

  it('returns 404 for a missing or foreign session', async () => {
    renameSessionMock.mockResolvedValue(false)
    req.body = { title: '新标题' }

    await renameSessionHandler(req as AuthRequest, res as Response)

    expect(statusMock).toHaveBeenCalledWith(404)
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 404,
      message: '会话不存在',
    }))
  })

  it('returns 500 when persistence fails', async () => {
    renameSessionMock.mockRejectedValue(new Error('database unavailable'))
    req.body = { title: '新标题' }

    await renameSessionHandler(req as AuthRequest, res as Response)

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 500,
      message: '重命名会话失败',
    }))
  })
})
