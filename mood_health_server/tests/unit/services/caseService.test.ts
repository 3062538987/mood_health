import { createCaseService } from '../../../src/services/caseService'
import { CaseRepository, CaseDto, CaseInterventionDto, InterventionType } from '../../../src/repositories/caseRepository'

const makeFakeRepo = (): CaseRepository => {
  const cases: CaseDto[] = []
  const interventions: CaseInterventionDto[] = []
  let nextId = 1
  let nextInterventionId = 1

  return {
    createCase: async (input) => {
      const c: CaseDto = {
        id: nextId++,
        studentUserId: input.studentUserId,
        assignedCounselorId: null,
        sourceSessionId: input.sourceSessionId ?? null,
        status: 'open',
        riskLevel: input.riskLevel ?? null,
        summary: input.summary ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      cases.push(c)
      return c
    },
    findById: async (id) => cases.find((c) => c.id === id) ?? null,
    findAll: async () => [...cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    findByStudentId: async (studentUserId, status) => {
      let result = cases.filter((c) => c.studentUserId === studentUserId)
      if (status) result = result.filter((c) => c.status === status)
      return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    findByCounselorId: async (counselorId, status) => {
      let result = cases.filter((c) => c.assignedCounselorId === counselorId)
      if (status) result = result.filter((c) => c.status === status)
      return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    findByStatus: async (status) => {
      return cases.filter((c) => c.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    assignCounselor: async (caseId, counselorId) => {
      const idx = cases.findIndex((c) => c.id === caseId && c.status === 'open')
      if (idx === -1) return false
      cases[idx] = { ...cases[idx], assignedCounselorId: counselorId, status: 'assigned', updatedAt: new Date().toISOString() }
      return true
    },
    updateStatus: async (caseId, status) => {
      const idx = cases.findIndex((c) => c.id === caseId)
      if (idx === -1) return false
      cases[idx] = { ...cases[idx], status, updatedAt: new Date().toISOString() }
      return true
    },
    createIntervention: async (input) => {
      const inter: CaseInterventionDto = {
        id: nextInterventionId++,
        caseId: input.caseId,
        counselorUserId: input.counselorUserId,
        interventionType: input.interventionType,
        content: input.content,
        referralTarget: input.referralTarget ?? null,
        referralReason: input.referralReason ?? null,
        closureSummary: input.closureSummary ?? null,
        createdAt: new Date().toISOString(),
      }
      interventions.push(inter)
      return inter
    },
    listInterventionsByCaseId: async (caseId) => {
      return interventions.filter((i) => i.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
  }
}

describe('CaseService', () => {
  let repo: CaseRepository
  let service: ReturnType<typeof createCaseService>
  const automaticRiskRepository = { syncCandidates: jest.fn(), recordTreeholeRisk: jest.fn() }

  beforeEach(() => {
    repo = makeFakeRepo()
    automaticRiskRepository.syncCandidates.mockReset().mockResolvedValue(0)
    service = createCaseService({ repository: repo, automaticRiskRepository: automaticRiskRepository as never })
  })

  describe('createCase', () => {
    it('creates a case with status open', async () => {
      const c = await service.createCase({
        studentUserId: 100,
        riskLevel: '中风险',
        summary: '筛查触发',
      })

      expect(c.status).toBe('open')
      expect(c.studentUserId).toBe(100)
      expect(c.riskLevel).toBe('中风险')
    })
  })

  describe('assignCase', () => {
    it('assigns a counselor to an open case', async () => {
      const created = await service.createCase({ studentUserId: 100 })
      const assigned = await service.assignCase({ caseId: created.id, counselorId: 200 })

      expect(assigned.status).toBe('assigned')
      expect(assigned.assignedCounselorId).toBe(200)
    })

    it('throws when case is not open', async () => {
      const created = await service.createCase({ studentUserId: 100 })
      await service.assignCase({ caseId: created.id, counselorId: 200 })

      await expect(service.assignCase({ caseId: created.id, counselorId: 300 })).rejects.toThrow('仅可分配')
    })
  })

  describe('referCase', () => {
    it('records referral and sets status to referred', async () => {
      const created = await service.createCase({ studentUserId: 100 })
      await service.assignCase({ caseId: created.id, counselorId: 200 })

      const result = await service.referCase({
        caseId: created.id,
        counselorUserId: 200,
        reason: '需要专业评估',
        target: 'XX市精神卫生中心',
      })

      expect(result.status).toBe('referred')

      const interventions = await repo.listInterventionsByCaseId(created.id)
      const referral = interventions.find((i) => i.interventionType === 'referral')
      expect(referral).toBeDefined()
      expect(referral!.referralTarget).toBe('XX市精神卫生中心')
    })
  })

  describe('closeCase', () => {
    it('records closure and sets status to closed', async () => {
      const created = await service.createCase({ studentUserId: 100 })
      await service.assignCase({ caseId: created.id, counselorId: 200 })

      const result = await service.closeCase({
        caseId: created.id,
        counselorUserId: 200,
        summary: '情绪稳定，定期随访',
      })

      expect(result.status).toBe('closed')

      const interventions = await repo.listInterventionsByCaseId(created.id)
      const closure = interventions.find((i) => i.interventionType === 'closure')
      expect(closure).toBeDefined()
      expect(closure!.closureSummary).toBe('情绪稳定，定期随访')
    })
  })

  describe('listMyCases', () => {
    it('student sees own cases', async () => {
      await service.createCase({ studentUserId: 100 })
      await service.createCase({ studentUserId: 200 })

      const cases = await service.listMyCases(100, 'student')
      expect(cases).toHaveLength(1)
      expect(cases[0].studentUserId).toBe(100)
    })

    it('counselor sees assigned cases', async () => {
      const c1 = await service.createCase({ studentUserId: 100 })
      await service.assignCase({ caseId: c1.id, counselorId: 300 })

      const cases = await service.listMyCases(300, 'counselor')
      expect(cases).toHaveLength(1)
    })

    it.each(['admin', 'super_admin'])('%s sees cases in every status', async (roleCode) => {
      const openCase = await service.createCase({ studentUserId: 100 })
      const closedCase = await service.createCase({ studentUserId: 200 })
      await repo.updateStatus(closedCase.id, 'closed')

      const cases = await service.listMyCases(999, roleCode)

      expect(cases.map((item) => item.id)).toEqual(
        expect.arrayContaining([openCase.id, closedCase.id])
      )
      expect(automaticRiskRepository.syncCandidates).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCaseDetail', () => {
    it('returns case with interventions', async () => {
      const created = await service.createCase({ studentUserId: 100 })
      await service.addIntervention({
        caseId: created.id,
        counselorUserId: 200,
        interventionType: 'note',
        content: '初次沟通',
      })

      const detail = await service.getCaseDetail(created.id)
      expect(detail).not.toBeNull()
      expect(detail!.case.id).toBe(created.id)
      expect(detail!.interventions).toHaveLength(1)
    })

    it('returns null for non-existent case', async () => {
      const detail = await service.getCaseDetail(999)
      expect(detail).toBeNull()
    })
  })
})
