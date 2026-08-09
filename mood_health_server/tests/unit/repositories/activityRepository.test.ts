import { createActivityRepository } from '../../../src/repositories/activityRepository'

// 轻量内存替身，仅实现 getStats 用到的 query/getConnection 契约
class FakeActivityConnection {
  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  release(): void {}
  async query<T>(): Promise<[T, unknown]> {
    return [[] as T, []]
  }
}

class FakeActivityPool {
  public readonly connection = new FakeActivityConnection()
  public readonly calls: { sql: string; params: unknown[] }[] = []
  private readonly responses: unknown[] = []

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
  }

  async getConnection(): Promise<FakeActivityConnection> {
    return this.connection
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

describe('activityRepository.getStats (R15: 统计聚合下沉 Repository)', () => {
  it('无日期过滤时聚合活动/参与/反馈统计', async () => {
    const db = new FakeActivityPool()
    db.queueRows([{ total: 10 }]) // 活动总数
    db.queueRows([{ total: 50 }]) // 参与人次
    db.queueRows([{ total: 8, avg_rating: 4.2 }]) // 反馈数与平均评分
    db.queueRows([{ r1: 1, r2: 1, r3: 2, r4: 2, r5: 2 }]) // 评分分布

    const repo = createActivityRepository(db)
    const stats = await repo.getStats()

    expect(stats).toEqual({
      totalActivities: 10,
      totalParticipants: 50,
      averageParticipants: 5,
      totalFeedback: 8,
      averageRating: 4.2,
      ratingDistribution: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 },
    })
    // 不应拼接 WHERE 条件
    expect(db.calls[0].sql).not.toContain('WHERE')
  })

  it('提供起止日期时以绑定参数追加过滤条件', async () => {
    const db = new FakeActivityPool()
    db.queueRows([{ total: 3 }])
    db.queueRows([{ total: 12 }])
    db.queueRows([{ total: 2, avg_rating: 3.5 }])
    db.queueRows([{ r1: 0, r2: 1, r3: 0, r4: 1, r5: 0 }])

    const repo = createActivityRepository(db)
    const stats = await repo.getStats('2026-01-01', '2026-12-31')

    expect(stats.totalActivities).toBe(3)
    expect(stats.averageRating).toBe(3.5)

    const firstParams = db.calls[0].params
    expect(firstParams).toContain('2026-01-01')
    expect(firstParams).toContain('2026-12-31')
    expect(db.calls[0].sql).toContain('a.start_time >= ?')
    expect(db.calls[0].sql).toContain('a.start_time <= ?')
  })
})
