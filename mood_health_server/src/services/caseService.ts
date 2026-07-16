import {
  CaseRepository,
  createCaseRepository,
  CaseDto,
  CaseInterventionDto,
  InterventionType,
} from '../repositories/caseRepository'
import {
  AssessmentRepository,
  createAssessmentRepository,
} from '../repositories/assessmentRepository'

export interface CaseServiceDependencies {
  repository?: CaseRepository
  assessmentRepository?: AssessmentRepository
}

export const createCaseService = (dependencies: CaseServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createCaseRepository()
  const getAssessmentRepo = () => dependencies.assessmentRepository ?? createAssessmentRepository()

  const createCase = async (input: {
    studentUserId: number
    riskLevel?: string | null
    summary?: string | null
  }): Promise<CaseDto> => {
    return repository.createCase({
      studentUserId: input.studentUserId,
      riskLevel: input.riskLevel,
      summary: input.summary,
    })
  }

  const assignCase = async (input: {
    caseId: number
    counselorId: number
  }): Promise<CaseDto> => {
    const ok = await repository.assignCounselor(input.caseId, input.counselorId)
    if (!ok) {
      throw new Error('仅可分配状态为"待处理"的个案')
    }
    const updated = await repository.findById(input.caseId)
    if (!updated) {
      throw new Error('个案不存在')
    }
    return updated
  }

  const addIntervention = async (input: {
    caseId: number
    counselorUserId: number
    interventionType: InterventionType
    content: string
    referralTarget?: string | null
    referralReason?: string | null
    closureSummary?: string | null
  }): Promise<CaseInterventionDto> => {
    const c = await repository.findById(input.caseId)
    if (!c) {
      throw new Error('个案不存在')
    }
    return repository.createIntervention({
      caseId: input.caseId,
      counselorUserId: input.counselorUserId,
      interventionType: input.interventionType,
      content: input.content,
      referralTarget: input.referralTarget,
      referralReason: input.referralReason,
      closureSummary: input.closureSummary,
    })
  }

  const referCase = async (input: {
    caseId: number
    counselorUserId: number
    reason: string
    target: string
  }): Promise<CaseDto> => {
    const c = await repository.findById(input.caseId)
    if (!c) {
      throw new Error('个案不存在')
    }

    await repository.createIntervention({
      caseId: input.caseId,
      counselorUserId: input.counselorUserId,
      interventionType: 'referral',
      content: `转介至 ${input.target}`,
      referralTarget: input.target,
      referralReason: input.reason,
    })

    await repository.updateStatus(input.caseId, 'referred')

    const updated = await repository.findById(input.caseId)
    return updated!
  }

  const closeCase = async (input: {
    caseId: number
    counselorUserId: number
    summary: string
  }): Promise<CaseDto> => {
    const c = await repository.findById(input.caseId)
    if (!c) {
      throw new Error('个案不存在')
    }

    await repository.createIntervention({
      caseId: input.caseId,
      counselorUserId: input.counselorUserId,
      interventionType: 'closure',
      content: '结案',
      closureSummary: input.summary,
    })

    await repository.updateStatus(input.caseId, 'closed')

    const updated = await repository.findById(input.caseId)
    return updated!
  }

  const listMyCases = async (userId: number, roleCode: string): Promise<CaseDto[]> => {
    if (roleCode === 'student') {
      return repository.findByStudentId(userId)
    }
    if (roleCode === 'counselor') {
      return repository.findByCounselorId(userId)
    }
    // super_admin sees all cases
    return repository.findByStatus('open')
  }

  const getCaseDetail = async (caseId: number): Promise<{
    case: CaseDto
    interventions: CaseInterventionDto[]
  } | null> => {
    const c = await repository.findById(caseId)
    if (!c) {
      return null
    }
    const interventions = await repository.listInterventionsByCaseId(caseId)
    return { case: c, interventions }
  }

  const autoCreateCase = async (assessmentSessionId: number): Promise<{
    caseId: number
    studentUserId: number
    riskLevel: string
    status: string
    created: boolean
  }> => {
    // 1. 获取测评会话
    const session = await getAssessmentRepo().getSessionById(assessmentSessionId)
    if (!session) {
      throw new Error('测评会话不存在')
    }

    const riskLevel = session.screeningLevel

    // 2. 仅高风险自动创建个案
    if (riskLevel !== '高风险') {
      return {
        caseId: 0,
        studentUserId: session.userId,
        riskLevel,
        status: 'skipped',
        created: false,
      }
    }

    // 3. 检查是否已有未结案的个案
    const existingCases = await repository.findByStudentId(session.userId)
    const openCase = existingCases.find(
      (c) => c.status === 'open' || c.status === 'in_progress' || c.status === 'referred'
    )
    if (openCase) {
      return {
        caseId: openCase.id,
        studentUserId: session.userId,
        riskLevel: openCase.riskLevel || riskLevel,
        status: openCase.status,
        created: false,
      }
    }

    // 4. 创建新个案
    const summary = `${session.instrumentName} ${session.versionLabel} 测评得分 ${session.rawScore}，风险等级：${riskLevel}`
    const newCase = await repository.createCase({
      studentUserId: session.userId,
      riskLevel,
      summary,
    })

    return {
      caseId: newCase.id,
      studentUserId: session.userId,
      riskLevel,
      status: newCase.status,
      created: true,
    }
  }

  return {
    createCase,
    assignCase,
    addIntervention,
    referCase,
    closeCase,
    listMyCases,
    getCaseDetail,
    autoCreateCase,
  }
}