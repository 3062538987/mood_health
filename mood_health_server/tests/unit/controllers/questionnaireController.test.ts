import { Response } from 'express'
import {
  getQuestionnaireDetail,
  getQuestionnaireList,
  getQuestionnaireQuestions,
  getUserAssessmentHistoryController,
  submitAssessment,
} from '../../../src/controllers/questionnaireController'
import {
  createUserAssessment,
  getQuestionnaireById,
  getQuestionnaires,
  getQuestionsByQuestionnaireId,
  getUserAssessmentHistory,
} from '../../../src/models/questionnaireModel'

var mockAssessmentService: {
  listQuestionnaires: jest.Mock
  getQuestionnaireById: jest.Mock
  listQuestionsByQuestionnaireId: jest.Mock
}

jest.mock('../../../src/models/questionnaireModel', () => ({
  createUserAssessment: jest.fn(),
  getQuestionnaireById: jest.fn(),
  getQuestionnaires: jest.fn(),
  getQuestionsByQuestionnaireId: jest.fn(),
  getUserAssessmentHistory: jest.fn(),
}))

jest.mock('../../../src/services/assessmentService', () => ({
  createAssessmentService: jest.fn(() => {
    mockAssessmentService = {
      listQuestionnaires: jest.fn(),
      getQuestionnaireById: jest.fn(),
      listQuestionsByQuestionnaireId: jest.fn(),
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
    })
    expect(detailResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取问卷详情成功',
      data: questionnaire,
    })
    expect(questionsResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取问卷题目成功',
      data: [{ ...question, options: ['从不', '偶尔', '经常', '总是'] }],
    })
    expect(getQuestionnaires).not.toHaveBeenCalled()
    expect(getQuestionnaireById).not.toHaveBeenCalled()
    expect(getQuestionsByQuestionnaireId).not.toHaveBeenCalled()
  })

  it('saves and returns a structured, non-diagnostic screening result', async () => {
    jest.mocked(getQuestionnaireById).mockResolvedValue(questionnaire)
    jest.mocked(getQuestionsByQuestionnaireId).mockResolvedValue([question])
    jest.mocked(createUserAssessment).mockResolvedValue({} as never)
    const response = createResponse()

    await submitAssessment(
      createRequest({ body: { questionnaire_id: 1, answers: [0] } }),
      response,
      next
    )

    expect(createUserAssessment).toHaveBeenCalledWith(
      1,
      1,
      1,
      expect.stringContaining('筛查提示')
    )
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '筛查结果已保存',
      data: expect.objectContaining({
        score: 1,
        screening_type: 'SDS',
        risk_level: 'low',
        result_text: expect.stringContaining('筛查提示'),
        disclaimer: expect.stringContaining('不构成医学诊断'),
      }),
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
    jest.mocked(getUserAssessmentHistory).mockResolvedValue(history)
    const response = createResponse()

    await getUserAssessmentHistoryController(createRequest(), response, next)

    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取筛查历史成功',
      data: history,
    })
  })
})
