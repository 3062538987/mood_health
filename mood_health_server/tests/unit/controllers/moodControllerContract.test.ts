import { Response } from 'express'
import {
  deleteMoodHandler,
  getMoodAnalysisHandler,
  getMoodList,
  getMoodTrend,
  getWeeklyReportHandler,
  recordMood,
  updateMoodHandler,
} from '../../../src/controllers/moodController'
import {
  createMood,
  deleteMood,
  findMoodById,
  getMoodAnalysis,
  getMoodsWithRelations,
  getMoodTotalCount,
  getMoodTrend as getMoodTrendModel,
  getWeeklyReport,
  updateMood,
} from '../../../src/models/moodModel'

var mockMoodService: {
  recordMood: jest.Mock
  listMoods: jest.Mock
  updateMood: jest.Mock
  deleteMood: jest.Mock
}

jest.mock('../../../src/models/moodModel', () => ({
  createMood: jest.fn(),
  createMoodWithRelations: jest.fn(),
  deleteMood: jest.fn(),
  findMoodById: jest.fn(),
  findMoodWithRelationsById: jest.fn(),
  getEmotionTypes: jest.fn(),
  getMoodAnalysis: jest.fn(),
  getMoodsByEmotionType: jest.fn(),
  getMoodsByUser: jest.fn(),
  getMoodsWithRelations: jest.fn(),
  getMoodTotalCount: jest.fn(),
  getMoodTrend: jest.fn(),
  getTags: jest.fn(),
  getWeeklyReport: jest.fn(),
  createOrGetTag: jest.fn(),
  updateMood: jest.fn(),
  updateMoodWithRelations: jest.fn(),
}))

jest.mock('../../../src/services/moodService', () => ({
  createMoodService: jest.fn(() => {
    mockMoodService = {
      recordMood: jest.fn(),
      listMoods: jest.fn(),
      updateMood: jest.fn(),
      deleteMood: jest.fn(),
    }
    return mockMoodService
  }),
}))

jest.mock('../../../src/models/adviceModel', () => ({
  createAdviceHistory: jest.fn(),
  getAdviceHistoryByUser: jest.fn(),
}))

jest.mock('../../../src/utils/cache', () => ({
  clearMoodCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

const createRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { userId: 1, username: 'student_demo', role: 'user' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  }) as never

describe('moodController response contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMoodService.deleteMood.mockResolvedValue(true)
  })

  it('returns a complete write envelope when recording a mood', async () => {
    mockMoodService.recordMood.mockResolvedValue(10)
    const req = createRequest({
      body: {
        emotions: [{ emotionTypeId: 1, intensity: 6 }],
        event: '普通的一天',
        trigger: '学习',
        recordDate: '2026-07-15',
        tagIds: [2],
      },
    })
    const res = createResponse()

    await recordMood(req, res)

    expect(mockMoodService.recordMood).toHaveBeenCalledWith({
      userId: 1,
      note: '普通的一天',
      trigger: '学习',
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 1, intensity: 6 }],
      tagIds: [2],
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '记录成功', data: null })
  })

  it('returns a paginated list DTO', async () => {
    mockMoodService.listMoods.mockResolvedValue({ list: [], total: 0, page: 2, limit: 10 })
    const req = createRequest({ query: { page: '2', size: '10' } })
    const res = createResponse()

    await getMoodList(req, res)

    expect(mockMoodService.listMoods).toHaveBeenCalledWith(1, { page: 2, limit: 10 })
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪记录成功',
      data: { list: [], total: 0, page: 2, limit: 10 },
    })
  })

  it('returns weekly, trend and descriptive statistics DTOs without changing their content', async () => {
    const weekly = { averageIntensity: 6, dailyData: [], mostFrequentMood: '平静', summary: '平稳' }
    const trend = { labels: [], datasets: [], summary: '暂无趋势数据' }
    const statistics = { avgIntensity: 6, recordCount: 2 }
    jest.mocked(getWeeklyReport).mockResolvedValue(weekly as never)
    jest.mocked(getMoodTrendModel).mockResolvedValue(trend as never)
    jest.mocked(getMoodAnalysis).mockResolvedValue(statistics as never)
    const weeklyResponse = createResponse()
    const trendResponse = createResponse()
    const statisticsResponse = createResponse()

    await getWeeklyReportHandler(createRequest(), weeklyResponse)
    await getMoodTrend(createRequest({ query: { range: 'month' } }), trendResponse)
    await getMoodAnalysisHandler(createRequest({ query: { range: 'month' } }), statisticsResponse)

    expect(weeklyResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪周报成功',
      data: weekly,
    })
    expect(trendResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪趋势成功',
      data: trend,
    })
    expect(statisticsResponse.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪统计成功',
      data: statistics,
    })
  })

  it('returns complete envelopes for update and delete writes', async () => {
    jest.mocked(findMoodById).mockResolvedValue({ id: 10, mood_type: '平静', intensity: 5 } as never)
    jest.mocked(updateMood).mockResolvedValue(true as never)
    jest.mocked(deleteMood).mockResolvedValue(true as never)
    const updateResponse = createResponse()
    const deleteResponse = createResponse()

    await updateMoodHandler(
      createRequest({ params: { id: '10' }, body: { moodType: '快乐', intensity: 8 } }),
      updateResponse
    )
    await deleteMoodHandler(createRequest({ params: { id: '10' } }), deleteResponse)

    expect(updateResponse.json).toHaveBeenCalledWith({ code: 0, message: '更新成功', data: null })
    expect(deleteResponse.json).toHaveBeenCalledWith({ code: 0, message: '删除成功', data: null })
  })
  it('routes normalized update and delete writes through mood service', async () => {
    mockMoodService.updateMood.mockResolvedValue(true)
    mockMoodService.deleteMood.mockResolvedValue(true)
    const updateResponse = createResponse()
    const deleteResponse = createResponse()

    await updateMoodHandler(
      createRequest({
        params: { id: '10' },
        body: {
          emotions: [{ emotionTypeId: 1, intensity: 8, isPrimary: true }],
          event: 'updated-note',
          trigger: 'updated-trigger',
          recordDate: '2026-07-15',
          tagIds: [2],
        },
      }),
      updateResponse
    )
    await deleteMoodHandler(createRequest({ params: { id: '10' } }), deleteResponse)

    expect(mockMoodService.updateMood).toHaveBeenCalledWith({
      id: 10,
      userId: 1,
      note: 'updated-note',
      trigger: 'updated-trigger',
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 1, intensity: 8, isPrimary: true }],
      tagIds: [2],
    })
    expect(mockMoodService.deleteMood).toHaveBeenCalledWith(1, 10)
    expect(updateResponse.json).toHaveBeenCalledWith({ code: 0, message: '更新成功', data: null })
    expect(deleteResponse.json).toHaveBeenCalledWith({ code: 0, message: '删除成功', data: null })
  })
})
