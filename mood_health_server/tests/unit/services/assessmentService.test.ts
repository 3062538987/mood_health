import {
  AssessmentRepository,
  createAssessmentRepository,
} from '../../../src/repositories/assessmentRepository'
import { createAssessmentService } from '../../../src/services/assessmentService'

jest.mock('../../../src/repositories/assessmentRepository', () => ({
  createAssessmentRepository: jest.fn(),
}))

const createRepository = (): jest.Mocked<AssessmentRepository> => ({
  listQuestionnaires: jest.fn(),
  getQuestionnaireById: jest.fn(),
  listQuestionsByQuestionnaireId: jest.fn(),
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
})
