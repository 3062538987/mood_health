import { createAssessmentRepository } from '../../../src/repositories/assessmentRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeAssessmentDb {
  public readonly calls: QueryCall[] = []
  private readonly responses: unknown[] = []

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
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
})
