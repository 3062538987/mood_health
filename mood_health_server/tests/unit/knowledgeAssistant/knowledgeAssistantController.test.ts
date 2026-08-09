import type { Response } from 'express'
import type { AuthRequest } from '../../../src/middleware/auth'
import { FastApiClientError } from '../../../src/services/fastApiClient'

const answerKnowledgeQuestionMock = jest.fn()

jest.mock('../../../src/services/knowledgeAssistantService', () => ({
  ...jest.requireActual('../../../src/services/knowledgeAssistantService'),
  answerKnowledgeQuestion: answerKnowledgeQuestionMock,
  getKnowledgeSessions: jest.fn(),
  getKnowledgeMessages: jest.fn(),
}))

import { postMessage } from '../../../src/controllers/knowledgeAssistantController'

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  return response as unknown as Response
}

describe('knowledgeAssistantController', () => {
  beforeEach(() => jest.clearAllMocks())

  it('derives the user id from authentication and ignores body identity', async () => {
    const req = {
      user: { userId: 7, username: 'student', role: 'student' },
      body: { message: '怎样改善睡眠？', sessionId: 's1', user_id: 99 },
    } as AuthRequest
    const res = createResponse()
    answerKnowledgeQuestionMock.mockResolvedValue({ sessionId: 's1', answer: '规律作息' })

    await postMessage(req, res)

    expect(answerKnowledgeQuestionMock).toHaveBeenCalledWith(7, '怎样改善睡眠？', 's1')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 0, data: expect.objectContaining({ sessionId: 's1' }) })
    )
  })

  const runWithError = async (error: unknown) => {
    const req = {
      user: { userId: 7, username: 'student', role: 'student' },
      body: { message: '怎样改善睡眠？' },
    } as AuthRequest
    const res = createResponse()
    answerKnowledgeQuestionMock.mockRejectedValue(error)
    await postMessage(req, res)
    return res
  }

  it('maps a 503 from the AI service to HTTP 503 (retryable)', async () => {
    const res = await runWithError(new FastApiClientError(503, '/api/rag/answer', true))
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('maps a network/unreachable error to HTTP 503', async () => {
    const res = await runWithError(new FastApiClientError('network', '/api/rag/answer', true))
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('maps any other upstream status (e.g. 429) to HTTP 502', async () => {
    const res = await runWithError(new FastApiClientError(429, '/api/rag/answer', true))
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('forwards the upstream requestId when present', async () => {
    const res = await runWithError(
      new FastApiClientError(503, '/api/rag/answer', true, 'req-abc-123'),
    )
    expect(res.status).toHaveBeenCalledWith(503)
    const payload = (res.json as jest.Mock).mock.calls[0][0]
    expect(payload.data).toEqual(expect.objectContaining({ requestId: 'req-abc-123' }))
  })

  it('falls back to 500 for unexpected AI client failures', async () => {
    const res = await runWithError(new FastApiClientError('config', '/api/rag/answer', false))
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
