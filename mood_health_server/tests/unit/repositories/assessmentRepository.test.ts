import { createAssessmentRepository } from '../../../src/repositories/assessmentRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeAssessmentDb {
  public readonly calls: QueryCall[] = []
  public readonly connection = new FakeAssessmentConnection()
  private readonly responses: unknown[] = []

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }

  async getConnection(): Promise<FakeAssessmentConnection> {
    return this.connection
  }
}

class FakeAssessmentConnection {
  public readonly calls: QueryCall[] = []
  public began = false
  public committed = false
  public rolledBack = false
  public released = false
  private readonly responses: unknown[] = []

  queueResult(result: unknown): void {
    this.responses.push(result)
  }

  async beginTransaction(): Promise<void> {
    this.began = true
  }

  async commit(): Promise<void> {
    this.committed = true
  }

  async rollback(): Promise<void> {
    this.rolledBack = true
  }

  release(): void {
    this.released = true
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

describe('assessmentRepository', () => {
  it('lists active assessment instruments from versioned MySQL tables with legacy DTO fields', async () => {
    const db = new FakeAssessmentDb()
    db.queueRows([
      {
        id: 12,
        title: '程序验证夹具',
        description: '仅用于自动化测试',
        type: 'TECHNICAL_FIXTURE',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
    ])
    const repository = createAssessmentRepository(db)

    await expect(repository.listQuestionnaires()).resolves.toEqual([
      {
        id: 12,
        title: '程序验证夹具',
        description: '仅用于自动化测试',
        type: 'TECHNICAL_FIXTURE',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
    ])

    expect(db.calls).toHaveLength(1)
    expect(db.calls[0].sql).toContain('assessment_instruments')
    expect(db.calls[0].sql).toContain('assessment_versions')
    expect(db.calls[0].sql).not.toContain('questionnaires')
    expect(db.calls[0].params).toEqual([])
  })

  it('gets one active assessment instrument by id from the versioned schema', async () => {
    const db = new FakeAssessmentDb()
    db.queueRows([
      {
        id: 12,
        title: '程序验证夹具',
        description: null,
        type: 'TECHNICAL_FIXTURE',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
    ])
    const repository = createAssessmentRepository(db)

    await expect(repository.getQuestionnaireById(12)).resolves.toMatchObject({
      id: 12,
      title: '程序验证夹具',
      description: '',
      type: 'TECHNICAL_FIXTURE',
    })

    expect(db.calls[0].sql).toContain('assessment_instruments')
    expect(db.calls[0].sql).toContain('assessment_versions')
    expect(db.calls[0].sql).not.toContain('questionnaires')
    expect(db.calls[0].params).toEqual([12])
  })

  it('lists assessment items with legacy question fields and boolean reverse flag', async () => {
    const db = new FakeAssessmentDb()
    db.queueRows([
      {
        id: 21,
        questionnaire_id: 12,
        question_text: '示例题目',
        question_type: 'single_choice',
        options: '["从不","偶尔"]',
        sort_order: 1,
        is_reverse: 1,
      },
    ])
    const repository = createAssessmentRepository(db)

    await expect(repository.listQuestionsByQuestionnaireId(12)).resolves.toEqual([
      {
        id: 21,
        questionnaire_id: 12,
        question_text: '示例题目',
        question_type: 'single_choice',
        options: '["从不","偶尔"]',
        sort_order: 1,
        is_reverse: true,
      },
    ])

    expect(db.calls[0].sql).toContain('assessment_items')
    expect(db.calls[0].sql).toContain('assessment_versions')
    expect(db.calls[0].sql).not.toContain('questions')
    expect(db.calls[0].params).toEqual([12])
  })

  it('creates submitted assessment session and answers in one transaction', async () => {
    const db = new FakeAssessmentDb()
    db.connection.queueResult({ insertId: 31, affectedRows: 1 })
    db.connection.queueResult({ affectedRows: 1 })
    db.connection.queueResult({ affectedRows: 1 })
    const repository = createAssessmentRepository(db)

    const sessionId = await repository.createSubmittedSession({
      userId: 7,
      questionnaireId: 12,
      score: 9,
      riskLevel: 'low',
      resultText: '筛查提示：低风险',
      answers: [
        { itemId: 21, value: 0, score: 1 },
        { itemId: 22, value: 3, score: 4 },
      ],
      submittedAt: new Date('2026-07-15T12:00:00.000Z'),
    })

    expect(sessionId).toBe(31)
    expect(db.connection.began).toBe(true)
    expect(db.connection.committed).toBe(true)
    expect(db.connection.released).toBe(true)
    expect(db.connection.calls[0].sql).toContain('INSERT INTO assessment_sessions')
    expect(db.connection.calls[0].params).toEqual([
      7,
      12,
      9,
      'low',
      JSON.stringify({ result_text: '筛查提示：低风险' }),
      new Date('2026-07-15T12:00:00.000Z'),
      new Date('2026-07-15T12:00:00.000Z'),
      new Date('2026-07-15T12:00:00.000Z'),
      new Date('2026-07-15T12:00:00.000Z'),
    ])
    expect(db.connection.calls[1].sql).toContain('INSERT INTO assessment_answers')
    expect(db.connection.calls[1].params).toEqual([31, 21, JSON.stringify(0), 1, new Date('2026-07-15T12:00:00.000Z')])
    expect(db.connection.calls[2].sql).toContain('INSERT INTO assessment_answers')
    expect(db.connection.calls[2].params).toEqual([31, 22, JSON.stringify(3), 4, new Date('2026-07-15T12:00:00.000Z')])
  })
})
