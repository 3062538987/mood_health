import { Response } from 'express'
import { counselingHandler } from '../../../src/controllers/aiInterpretationController'

var mockCallDirect: jest.Mock

jest.mock('../../../src/utils/ai/aiCallService', () => {
  mockCallDirect = jest.fn()
  return {
    callDirect: mockCallDirect,
  }
})

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('aiInterpretationController counseling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('generates counseling replies through the AI call service', async () => {
    mockCallDirect.mockResolvedValue('可以先把压力来源写下来，再拆成一个今天能完成的小步骤。')
    const response = createResponse()

    await counselingHandler(
      {
        user: { userId: 1, username: 'student_demo', role: 'student' },
        body: {
          message: '我最近压力很大',
          context: [{ role: 'assistant', content: '愿意多说一点吗？' }],
          mood: ['焦虑'],
        },
      } as never,
      response
    )

    expect(mockCallDirect).toHaveBeenCalledWith(
      expect.stringContaining('心理支持助手'),
      expect.stringContaining('我最近压力很大'),
      expect.objectContaining({ temperature: 0.6, maxTokens: 800 })
    )
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: 'AI 咨询回复生成成功',
      data: {
        response: '可以先把压力来源写下来，再拆成一个今天能完成的小步骤。',
        riskLevel: 'low',
        hasRiskContent: false,
      },
      requestId: expect.any(String),
    })
  })
})
