import { getActivityStatsHandler } from '../../../src/controllers/activityController'
import { createActivityRepository } from '../../../src/repositories/activityRepository'

// 用 jest.mock 把 activityRepository 替换成仅含 getStats 的替身，
// 从而在不连 MySQL 的情况下验证控制器层的 R15 改写与参数校验。
jest.mock('../../../src/repositories/activityRepository', () => ({
  createActivityRepository: jest.fn(() => ({ getStats: jest.fn() })),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

jest.mock('../../../src/utils/cache', () => ({
  setCache: jest.fn(),
  getCache: jest.fn(),
  clearActivityCache: jest.fn(),
}))

const createMock = createActivityRepository as jest.Mock
const repoInstance = createMock.mock.results[0].value as { getStats: jest.Mock }
const fakeGetStats = repoInstance.getStats

interface FakeRes {
  status: jest.Mock
  json: jest.Mock
}

const makeRes = (): FakeRes => {
  const res: FakeRes = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res
}

type StatsReq = Parameters<typeof getActivityStatsHandler>[0]

const baseStats = {
  totalActivities: 1,
  totalParticipants: 2,
  averageParticipants: 2,
  totalFeedback: 0,
  averageRating: 0,
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

describe('activityController.getActivityStatsHandler (R15 控制器层)', () => {
  beforeEach(() => {
    fakeGetStats.mockReset()
  })

  it('startDate 格式非法时返回 400 且不调用 getStats', async () => {
    const req = { query: { startDate: '2026/01/01' } } as unknown as StatsReq
    const res = makeRes()

    await getActivityStatsHandler(req, res as unknown as Parameters<typeof getActivityStatsHandler>[1])

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fakeGetStats).not.toHaveBeenCalled()
  })

  it('合法参数时透传 startDate/endDate 并回包统计结果', async () => {
    fakeGetStats.mockResolvedValue(baseStats)
    const req = {
      query: { startDate: '2026-01-01', endDate: '2026-12-31' },
    } as unknown as StatsReq
    const res = makeRes()

    await getActivityStatsHandler(req, res as unknown as Parameters<typeof getActivityStatsHandler>[1])

    expect(fakeGetStats).toHaveBeenCalledWith('2026-01-01', '2026-12-31')
    expect(res.json).toHaveBeenCalledTimes(1)
    const payload = res.json.mock.calls[0][0]
    expect(payload.data).toEqual(baseStats)
  })
})
