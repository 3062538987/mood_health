// Mock all dependencies before importing the controller
jest.mock('../../../src/config/mysql', () => ({
  getMysqlPool: jest.fn().mockReturnValue({ query: jest.fn() }),
}))

jest.mock('../../../src/utils/ai/aiCallService', () => ({
  callWithTemplate: jest.fn().mockResolvedValue('AI 解读内容'),
  isAiAvailable: jest.fn().mockReturnValue(true),
  callDirect: jest.fn(),
}))

import { Response } from 'express'
import { interpretAssessmentHandler } from '../../../src/controllers/aiInterpretationController'

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('aiInterpretationController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('generates assessment interpretation and returns success', async () => {
    const response = createResponse()

    await interpretAssessmentHandler(
      {
        user: { userId: 1, username: 'student_demo', role: 'student' },
        body: {
          scaleName: 'GAD-7',
          scaleType: 'anxiety',
          totalScore: 10,
          maxScore: 21,
          itemScores: [{ label: '感到紧张', score: 2 }],
          riskLevel: 'medium',
        },
      } as never,
      response
    )

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        message: 'AI 解读生成成功',
      })
    )
  })
})
