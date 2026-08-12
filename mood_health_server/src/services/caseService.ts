import {
  CaseRepository,
  createCaseRepository,
  CaseDto,
  CaseInterventionDto,
  InterventionType,
} from '../repositories/caseRepository'
import {
  AssessmentRepository,
} from '../repositories/assessmentRepository'

export interface CaseServiceDependencies {
  repository?: CaseRepository
  assessmentRepository?: AssessmentRepository
}

export const createCaseService = (dependencies: CaseServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createCaseRepository()

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
    if (roleCode === 'admin' || roleCode === 'super_admin') {
      return repository.findAll()
    }
    return []
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

  return {
    createCase,
    assignCase,
    addIntervention,
    referCase,
    closeCase,
    listMyCases,
    getCaseDetail,
  }
}

export type CaseService = ReturnType<typeof createCaseService>
