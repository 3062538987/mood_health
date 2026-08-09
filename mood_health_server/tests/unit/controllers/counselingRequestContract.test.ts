import { Response } from 'express'

import { sessionCounselingHandler } from '../../../src/controllers/counselingController'
import { AuthRequest } from '../../../src/middleware/auth'
import { generateUnifiedAssistantResponse } from '../../../src/services/unifiedAssistantService'

jest.mock('../../../src/services/counselingSessionService', () => ({
  saveMessagePair: jest.fn(),
  loadSession: jest.fn(),
  listSessions: jest.fn(),
  buildContextMessages: jest.fn(),
  generateSessionId: jest.fn(),
  renameSession: jest.fn(),
}))

jest.mock('../../../src/services/unifiedAssistantService', () => ({
  generateUnifiedAssistantResponse: jest.fn(),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}))

const generateUnifiedAssistantResponseMock = jest.mocked(generateUnifiedAssistantResponse)

describe('session counseling request contract', () => {
  let req: Partial<AuthRequest>
  let res: Partial<Response>
  let jsonMock: jest.Mock

  beforeEach(() => {
    jsonMock = jest.fn()
    res = { json: jsonMock, status: jest.fn().mockReturnValue({ json: jsonMock }) }
    req = {
      user: { userId: 7, username: 'student', role: 'student' } as any,
      body: { message: '  hello  ', sessionId: '14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19' },
    }
    generateUnifiedAssistantResponseMock.mockResolvedValue({} as never)
  })

  it('trims the message and defaults allowWebSearch to false at the service boundary', async () => {
    await sessionCounselingHandler(req as AuthRequest, res as Response)

    expect(generateUnifiedAssistantResponseMock).toHaveBeenCalledWith(
      7,
      '14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19',
      'hello',
      false
    )
  })

  it('forwards an approved allowWebSearch boolean with the trimmed message', async () => {
    req.body = {
      message: '  hello  ',
      sessionId: '14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19',
      allowWebSearch: true,
    }

    await sessionCounselingHandler(req as AuthRequest, res as Response)

    expect(generateUnifiedAssistantResponseMock).toHaveBeenCalledWith(
      7,
      '14c9d3d7-8bdb-4ee6-a6ec-711bfa467c19',
      'hello',
      true
    )
  })
})
