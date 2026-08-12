import { createCaseRepository } from '../../../src/repositories/caseRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeCasePool {
  private readonly responses: Array<unknown> = []
  private readonly calls: QueryCall[] = []

  queueResult(result: unknown): void {
    this.responses.push(result)
  }

  getCalls(): QueryCall[] {
    return this.calls
  }

  async getConnection(): Promise<never> {
    throw new Error('getConnection not used in case repository')
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

describe('CaseRepository', () => {
  let pool: FakeCasePool
  let repo: ReturnType<typeof createCaseRepository>

  beforeEach(() => {
    pool = new FakeCasePool()
    repo = createCaseRepository(pool)
  })

  describe('createCase', () => {
    it('inserts a case with status open', async () => {
      pool.queueResult({ insertId: 1, affectedRows: 1 })

      const result = await repo.createCase({
        studentUserId: 100,
        riskLevel: '中风险',
        summary: '量表筛查触发',
      })

      const calls = pool.getCalls()
      expect(result.id).toBe(1)
      expect(result.status).toBe('open')
      expect(result.studentUserId).toBe(100)
      expect(result.riskLevel).toBe('中风险')
      expect(calls[0].sql).toContain("'open'")
      expect(calls[0].params[0]).toBe(100)
    })
  })

  describe('findById', () => {
    it('returns a case when found', async () => {
      pool.queueResult([
        {
          id: 1,
          student_user_id: 100,
          assigned_counselor_id: null,
          source_session_id: null,
          status: 'open',
          risk_level: '中风险',
          summary: 'test',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ])

      const c = await repo.findById(1)

      expect(c).not.toBeNull()
      expect(c!.id).toBe(1)
      expect(c!.status).toBe('open')
      expect(c!.riskLevel).toBe('中风险')
    })

    it('returns null when not found', async () => {
      pool.queueResult([])
      const c = await repo.findById(999)
      expect(c).toBeNull()
    })
  })

  describe('findAll', () => {
    it('returns every status ordered by created_at DESC', async () => {
      pool.queueResult([
        {
          id: 2,
          student_user_id: 200,
          assigned_counselor_id: 300,
          source_session_id: null,
          status: 'closed',
          risk_level: 'high',
          summary: 'closed case',
          created_at: '2026-02-01T00:00:00.000Z',
          updated_at: '2026-02-02T00:00:00.000Z',
        },
        {
          id: 1,
          student_user_id: 100,
          assigned_counselor_id: null,
          source_session_id: null,
          status: 'open',
          risk_level: 'moderate',
          summary: 'open case',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ])

      const cases = await repo.findAll()

      expect(cases.map((item) => item.status)).toEqual(['closed', 'open'])
      expect(pool.getCalls()[0].sql).toBe('SELECT * FROM cases ORDER BY created_at DESC')
      expect(pool.getCalls()[0].params).toEqual([])
    })
  })

  describe('findByStudentId', () => {
    it('returns cases ordered by created_at DESC', async () => {
      pool.queueResult([
        { id: 2, student_user_id: 100, status: 'closed', created_at: '2026-02-01T00:00:00.000Z' },
        { id: 1, student_user_id: 100, status: 'open', created_at: '2026-01-01T00:00:00.000Z' },
      ])

      const cases = await repo.findByStudentId(100)

      expect(cases).toHaveLength(2)
      expect(cases[0].id).toBe(2)
    })

    it('filters by status when provided', async () => {
      pool.queueResult([])
      await repo.findByStudentId(100, 'open')
      const calls = pool.getCalls()
      expect(calls[calls.length - 1].sql).toContain('AND status = ?')
      expect(calls[calls.length - 1].params).toContain('open')
    })
  })

  describe('findByCounselorId', () => {
    it('queries by assigned_counselor_id', async () => {
      pool.queueResult([])
      await repo.findByCounselorId(200)
      const calls = pool.getCalls()
      expect(calls[calls.length - 1].sql).toContain('assigned_counselor_id')
    })
  })

  describe('assignCounselor', () => {
    it('updates status to assigned and sets counselor', async () => {
      pool.queueResult({ affectedRows: 1 })

      const ok = await repo.assignCounselor(1, 200)

      expect(ok).toBe(true)
      const calls = pool.getCalls()
      const sql = calls[calls.length - 1].sql
      expect(sql).toContain("status = 'assigned'")
      expect(sql).toContain("assigned_counselor_id")
    })

    it('returns false when case is not open', async () => {
      pool.queueResult({ affectedRows: 0 })
      const ok = await repo.assignCounselor(1, 200)
      expect(ok).toBe(false)
    })
  })

  describe('updateStatus', () => {
    it('updates the case status', async () => {
      pool.queueResult({ affectedRows: 1 })
      const ok = await repo.updateStatus(1, 'closed')
      expect(ok).toBe(true)
    })
  })

  describe('createIntervention', () => {
    it('creates a note intervention', async () => {
      pool.queueResult({ insertId: 10, affectedRows: 1 })

      const result = await repo.createIntervention({
        caseId: 1,
        counselorUserId: 200,
        interventionType: 'note',
        content: '初次沟通记录',
      })

      expect(result.id).toBe(10)
      expect(result.interventionType).toBe('note')
      expect(result.content).toBe('初次沟通记录')
    })

    it('creates a referral intervention with target and reason', async () => {
      pool.queueResult({ insertId: 11, affectedRows: 1 })

      const result = await repo.createIntervention({
        caseId: 1,
        counselorUserId: 200,
        interventionType: 'referral',
        content: '转介至校外机构',
        referralTarget: 'XX市精神卫生中心',
        referralReason: '需要专业精神科评估',
      })

      expect(result.referralTarget).toBe('XX市精神卫生中心')
      expect(result.referralReason).toBe('需要专业精神科评估')
    })

    it('creates a closure intervention with summary', async () => {
      pool.queueResult({ insertId: 12, affectedRows: 1 })

      const result = await repo.createIntervention({
        caseId: 1,
        counselorUserId: 200,
        interventionType: 'closure',
        content: '结案',
        closureSummary: '学生情绪稳定，建议定期随访',
      })

      expect(result.closureSummary).toBe('学生情绪稳定，建议定期随访')
    })
  })

  describe('listInterventionsByCaseId', () => {
    it('returns interventions ordered by created_at ASC', async () => {
      pool.queueResult([
        { id: 1, case_id: 1, counselor_user_id: 200, intervention_type: 'note', content: 'first', referral_target: null, referral_reason: null, closure_summary: null, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 2, case_id: 1, counselor_user_id: 200, intervention_type: 'note', content: 'second', referral_target: null, referral_reason: null, closure_summary: null, created_at: '2026-01-02T00:00:00.000Z' },
      ])

      const interventions = await repo.listInterventionsByCaseId(1)

      expect(interventions).toHaveLength(2)
      expect(interventions[0].content).toBe('first')
      expect(interventions[1].content).toBe('second')
    })
  })
})
