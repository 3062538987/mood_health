import {
  AssessmentRepository,
  createAssessmentRepository,
} from '../../../src/repositories/assessmentRepository'
import { createAssessmentService } from '../../../src/services/assessmentService'

jest.mock('../../../src/repositories/assessmentRepository', () => ({
  createAssessmentRepository: jest.fn(),
}))

jest.mock('../../../src/services/caseService', () => ({
  createCaseService: jest.fn(() => ({
    autoCreateCase: jest.fn().mockResolvedValue({ created: true }),
  })),
}))

const createRepository = (): jest.Mocked<AssessmentRepository> => ({
  listQuestionnaires: jest.fn(),
  getQuestionnaireById: jest.fn(),
  listQuestionsByQuestionnaireId: jest.fn(),
  createSubmittedSession: jest.fn(),
  listUserAssessmentHistory: jest.fn(),
  getScoringRules: jest.fn(),
  getSessionById: jest.fn(),
  listAllSessions: jest.fn(),
  getSessionByIdAdmin: jest.fn(),
})

describe('assessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns assessment catalog, detail and questions through the repository boundary', async () => {
    const repository = createRepository()
    repository.listQuestionnaires.mockResolvedValue([
      {
        id: 12,
        title: '程序验证夹具',
        description: '仅用于自动化测试',
        type: 'TECHNICAL_FIXTURE',
        created_at: '2026-07-15T00:00:00.000Z',
      },
    ])
    repository.getQuestionnaireById.mockResolvedValue({
      id: 12,
      title: '程序验证夹具',
      description: '仅用于自动化测试',
      type: 'TECHNICAL_FIXTURE',
      created_at: '2026-07-15T00:00:00.000Z',
    })
    repository.listQuestionsByQuestionnaireId.mockResolvedValue([
      {
        id: 21,
        questionnaire_id: 12,
        question_text: '示例题目',
        question_type: 'single_choice',
        options: '["从不","偶尔"]',
        sort_order: 1,
        is_reverse: false,
      },
    ])
    jest.mocked(createAssessmentRepository).mockReturnValue(repository)
    const service = createAssessmentService()

    await expect(service.listQuestionnaires()).resolves.toHaveLength(1)
    await expect(service.getQuestionnaireById(12)).resolves.toMatchObject({ id: 12 })
    await expect(service.listQuestionsByQuestionnaireId(12)).resolves.toEqual([
      {
        id: 21,
        questionnaire_id: 12,
        question_text: '示例题目',
        question_type: 'single_choice',
        options: '["从不","偶尔"]',
        sort_order: 1,
        is_reverse: false,
      },
    ])
    expect(repository.listQuestionnaires).toHaveBeenCalledWith()
    expect(repository.getQuestionnaireById).toHaveBeenCalledWith(12)
    expect(repository.listQuestionsByQuestionnaireId).toHaveBeenCalledWith(12)
  })

  it('submits assessment through scoring engine and returns result', async () => {
    const repository = createRepository()
    repository.getQuestionnaireById.mockResolvedValue({
      id: 1,
      title: '测试量表',
      description: '测试用',
      type: 'TEST',
      created_at: '2026-07-15T00:00:00.000Z',
    })
    repository.getScoringRules.mockResolvedValue({
      scoringRule: { type: 'sum', min_score: 0, max_score: 15, reverse_items: [] },
      riskStratification: {
        levels: [
          { label: '低风险', range: [0, 4], color: 'green' },
          { label: '中风险', range: [5, 9], color: 'yellow' },
          { label: '高风险', range: [10, 15], color: 'red' },
        ],
      },
      suggestionTemplate: {
        levels: { '低风险': '正常', '中风险': '关注', '高风险': '干预' },
      },
    })
    repository.createSubmittedSession.mockResolvedValue(31)
    jest.mocked(createAssessmentRepository).mockReturnValue(repository)
    const service = createAssessmentService()

    const result = await service.submitAssessment({
      userId: 7,
      questionnaireId: 1,
      answers: [
        { itemId: 1, score: 2 },
        { itemId: 2, score: 3 },
        { itemId: 3, score: 3 },
      ],
    })

    expect(result).toMatchObject({
      sessionId: 31,
      totalScore: 8,
      riskLevel: '中风险',
      riskColor: 'yellow',
      suggestion: '关注',
    })
    expect(repository.getQuestionnaireById).toHaveBeenCalledWith(1)
    expect(repository.getScoringRules).toHaveBeenCalledWith(1)
    expect(repository.createSubmittedSession).toHaveBeenCalled()
  })

  it('lists user assessment history through the repository boundary', async () => {
    const repository = createRepository()
    repository.listUserAssessmentHistory.mockResolvedValue([
      {
        id: 31,
        user_id: 7,
        questionnaire_id: 12,
        score: 9,
        result_text: '筛查提示：低风险',
        created_at: '2026-07-15T12:00:00.000Z',
        title: '程序验证夹具',
        type: 'TECHNICAL_FIXTURE',
      },
    ])
    jest.mocked(createAssessmentRepository).mockReturnValue(repository)
    const service = createAssessmentService()

    await expect(service.listUserAssessmentHistory(7)).resolves.toEqual([
      {
        id: 31,
        user_id: 7,
        questionnaire_id: 12,
        score: 9,
        result_text: '筛查提示：低风险',
        created_at: '2026-07-15T12:00:00.000Z',
        title: '程序验证夹具',
        type: 'TECHNICAL_FIXTURE',
      },
    ])
    expect(repository.listUserAssessmentHistory).toHaveBeenCalledWith(7)
  })
})