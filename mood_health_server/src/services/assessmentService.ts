import {
  AssessmentRepository,
  createAssessmentRepository,
  CreateSubmittedAssessmentSessionInput,
  SubmittedAssessmentAnswerInput,
} from '../repositories/assessmentRepository'
import { scoreAssessment, ScoringRule, RiskStratification, SuggestionTemplate } from '../utils/scoringEngine'
import { HttpException } from '../utils/errors'

export interface AssessmentServiceDependencies {
  repository?: AssessmentRepository
}

export interface SubmitAssessmentInput {
  userId: number
  questionnaireId: number
  answers: Array<{ itemId: number; score: number }>
}

export const createAssessmentService = (dependencies: AssessmentServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createAssessmentRepository()

  const listQuestionnaires = async () => repository.listQuestionnaires()

  const getQuestionnaireById = async (id: number) => repository.getQuestionnaireById(id)

  const listQuestionsByQuestionnaireId = async (questionnaireId: number) =>
    repository.listQuestionsByQuestionnaireId(questionnaireId)

  const listUserAssessmentHistory = async (userId: number) =>
    repository.listUserAssessmentHistory(userId)

  const getSessionDetail = async (sessionId: number) =>
    repository.getSessionById(sessionId)

  const listAllSessions = async (params: {
    page?: number
    pageSize?: number
    userId?: number
    instrumentId?: number
    riskLevel?: string
    startDate?: string
    endDate?: string
  }) => repository.listAllSessions(params)

  const getSessionDetailAdmin = async (sessionId: number) =>
    repository.getSessionByIdAdmin(sessionId)

  const submitAssessment = async (input: SubmitAssessmentInput) => {
    // 1. 验证量表存在且已批准
    const questionnaire = await repository.getQuestionnaireById(input.questionnaireId)
    if (!questionnaire) {
      throw new HttpException('测评工具不存在', 404)
    }

    // 2. 检查量表是否已批准
    const instrument = await repository.getInstrumentById(input.questionnaireId)
    if (!instrument || instrument.status !== 'approved') {
      throw new HttpException('该测评工具尚未通过审核，暂不可用', 403)
    }

    // 3. 获取计分规则
    const rules = await repository.getScoringRules(input.questionnaireId)
    if (!rules) {
      throw new HttpException('测评计分规则未配置', 500)
    }

    // 4. 计分
    const scoringResult = scoreAssessment(
      input.answers,
      rules.scoringRule as unknown as ScoringRule,
      rules.riskStratification as unknown as RiskStratification,
      rules.suggestionTemplate as unknown as SuggestionTemplate
    )

    // 5. 构建插入数据
    const now = new Date()
    const sessionInput: CreateSubmittedAssessmentSessionInput = {
      userId: input.userId,
      questionnaireId: input.questionnaireId,
      score: scoringResult.totalScore,
      riskLevel: scoringResult.riskLevel,
      resultText: JSON.stringify(scoringResult),
      answers: input.answers.map((a) => ({
        itemId: a.itemId,
        value: a.score,
        score: a.score,
      })) as SubmittedAssessmentAnswerInput[],
      submittedAt: now,
    }

    // 6. 创建会话 + 高风险个案（同一事务防重复）
    const isHighRisk = scoringResult.riskLevel === '高风险'
    const sessionId = await repository.createSubmittedSessionWithCase(sessionInput, isHighRisk)

    return {
      sessionId,
      ...scoringResult,
    }
  }

  return {
    listQuestionnaires,
    getQuestionnaireById,
    listQuestionsByQuestionnaireId,
    submitAssessment,
    listUserAssessmentHistory,
    getSessionDetail,
    listAllSessions,
    getSessionDetailAdmin,
  }
}

export type AssessmentService = ReturnType<typeof createAssessmentService>