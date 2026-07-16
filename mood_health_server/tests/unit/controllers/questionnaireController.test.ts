import { Response } from 'express'
import {
  getQuestionnaireDetail,
  getQuestionnaireList,
  getQuestionnaireQuestions,
  getUserAssessmentHistoryController,
  submitAssessment,
} from '../../../src/controllers/questionnaireController'
var mockAssessmentService: {
  listQuestionnaires: jest.Mock
  getQuestionnaireById: jest.Mock
  listQuestionsByQuestionnaireId: jest.Mock
  submitAssessment: jest.Mock
  listUserAssessmentHistory: jest.Mock
  getSessionDetail: jest.Mock
}

jest.mock('../../../src/services/assessmentService', () => ({
  createAssessmentService: jest.fn(() => {
    mockAssessmentService = {
      listQuestionnaires: jest.fn(),
      getQuestionnaireById: jest.fn(),
      listQuestionsByQuestionnaireId: jest.fn(),
      submitAssessment: jest.fn(),
      listUserAssessmentHistory: jest.fn(),
      getSessionDetail: jest.fn(),
    }
    return mockAssessmentService
  }),
}))

const questionnaire = {
  id: 1,
  title: '情绪状态自评',
  description: '用于自我筛查',
  type: 'SDS',
  created_at: '2026-01-01T00:00:00.000Z',
}

const question = {
  id: 1,
  questionnaire_id: 1,
  question_text: '示例问题',
  question_type: 'single',
  options: JSON.stringify(['从不', '偶尔', '经常', '总是']),
  sort_order: 1,
  is_reverse: false,
}

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

const createRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { userId: 1, username: 'student_demo', role: 'user' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  }) as never

const next = jest.fn()

describe('questionnaireController contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns complete list, detail and question envelopes', async () => {
    mockAssessmentService.listQuestionnaires.mockResolvedValue([questionnaire])
    mockAssessmentService.getQuestionnaireById.mockResolvedValue(questionnaire)
    mockAssessmentService.listQuestionsByQuestionnaireId.mockResolvedValue([question])
    const listResponse = createResponse()
    const detailResponse = createResponse()
    const questionsResponse = createResponse()

    await getQuestionnaireList(createRequest(), listResponse, next)
    await getQuestionnaireDetail(createRequest({ params: { id: '1' } }), detailResponse, next)
    await getQuestionnaireQuestions(createRequest({ params: { id: '1' } }), questionsResponse, next)

    expect(listResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取问卷列表成功',
      data: [questionnaire],
      requestId: expect.any(String),
    })
    expect(detailResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取问卷详情成功',
      data: questionnaire,
      requestId: expect.any(String),
    })
    expect(questionsResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取问卷题目成功',
      data: [{ ...question, options: ['从不', '偶尔', '经常', '总是'] }],
      requestId: expect.any(String),
    })
  })

  it('accepts assessment submissions and returns scoring result', async () => {
    const response = createResponse()
    mockAssessmentService.submitAssessment.mockResolvedValue({
      sessionId: 1,
      totalScore: 8,
      riskLevel: '中风险',
      riskColor: 'yellow',
      suggestion: '建议关注',
    })

    await submitAssessment(
      createRequest({
        body: { questionnaire_id: 1, answers: [{ itemId: 21, score: 2 }] },
      }),
      response,
      next
    )

    expect(mockAssessmentService.submitAssessment).toHaveBeenCalledWith({
      userId: 1,
      questionnaireId: 1,
      answers: [{ itemId: 21, score: 2 }],
    })
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '测评提交成功',
      data: {
        sessionId: 1,
        totalScore: 8,
        riskLevel: '中风险',
        riskColor: 'yellow',
        suggestion: '建议关注',
      },
      requestId: expect.any(String),
    })
  })

  it('returns assessment history in a complete envelope', async () => {
    const history = [
      {
        id: 1,
        user_id: 1,
        questionnaire_id: 1,
        score: 40,
        result_text: '筛查提示：当前得分处于较低风险区间。',
        created_at: '2026-01-01T00:00:00.000Z',
        title: '情绪状态自评',
        type: 'SDS',
      },
    ]
    mockAssessmentService.listUserAssessmentHistory.mockResolvedValue(history)
    const response = createResponse()

    await getUserAssessmentHistoryController(createRequest(), response, next)

    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取筛查历史成功',
      data: history,
      requestId: expect.any(String),
    })
  })
})
