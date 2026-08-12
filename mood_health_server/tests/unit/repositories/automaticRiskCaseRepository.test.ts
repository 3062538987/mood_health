import { createAutomaticRiskCaseRepository } from '../../../src/repositories/automaticRiskCaseRepository'

type QueryCall = { sql: string; params: unknown[] }

class FakeRiskPool {
  readonly calls: QueryCall[] = []
  readonly responses: unknown[] = []
  queue(value: unknown) { this.responses.push(value) }
  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

describe('automaticRiskCaseRepository', () => {
  it('uses three independent OR signals and upserts one automatic case per user', async () => {
    const db = new FakeRiskPool()
    db.queue([{ user_id: 7 }])
    db.queue([{ user_id: 8 }])
    db.queue([{ user_id: 7 }, { user_id: 9 }])
    db.queue({ affectedRows: 1 })
    db.queue({ affectedRows: 1 })
    db.queue({ affectedRows: 1 })
    const repository = createAutomaticRiskCaseRepository(db)

    await expect(repository.syncCandidates()).resolves.toBe(3)

    const sqlText = db.calls.map((call) => call.sql).join('\n')
    expect(sqlText).toContain('COUNT(*) = 7')
    expect(sqlText).toContain('daily_average < 5')
    expect(sqlText).toContain("signal_type = 'treehole_high_risk'")
    expect(sqlText).toContain("risk_level = 'high'")

    const upsertCalls = db.calls.slice(3)
    expect(upsertCalls[0].params).toEqual(
      expect.arrayContaining([
        7,
        '自动风险规则命中：连续7天情绪记录评分低于5分；AI问答出现高风险内容',
        JSON.stringify(['连续7天情绪记录评分低于5分', 'AI问答出现高风险内容']),
      ])
    )
    expect(upsertCalls[1].params).toEqual(
      expect.arrayContaining([8, JSON.stringify(['树洞出现高风险内容'])])
    )
  })

  it('records treehole risk without storing the rejected private content', async () => {
    const db = new FakeRiskPool()
    db.queue({ affectedRows: 1 })
    const repository = createAutomaticRiskCaseRepository(db)

    await repository.recordTreeholeRisk(7)

    expect(db.calls[0].sql).toContain('risk_signal_events')
    expect(db.calls[0].params).toEqual([7, expect.any(Date)])
  })
})
