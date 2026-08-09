import { Response } from 'express'
import {
  deleteMoodHandler,
  getMoodList,
  getMoodTypes,
  getMoodTrend,
  getWeeklyReportHandler,
  recordMood,
} from '../../../src/controllers/moodController'
var mockMoodService: {
  recordMood: jest.Mock
  listMoods: jest.Mock
  updateMood: jest.Mock
  deleteMood: jest.Mock
  listEmotionTypes: jest.Mock
  listTags: jest.Mock
  createOrGetTag: jest.Mock
  createOrGetTagsBatch: jest.Mock
  getMoodTrend: jest.Mock
  getWeeklyReport: jest.Mock
}

jest.mock('../../../src/services/moodService', () => ({
  createMoodService: jest.fn(() => {
    mockMoodService = {
      recordMood: jest.fn(),
      listMoods: jest.fn(),
      updateMood: jest.fn(),
      deleteMood: jest.fn(),
      listEmotionTypes: jest.fn(),
      listTags: jest.fn(),
      createOrGetTag: jest.fn(),
      createOrGetTagsBatch: jest.fn(),
      getMoodTrend: jest.fn(),
      getWeeklyReport: jest.fn(),
    }
    return mockMoodService
  }),
}))

jest.mock('../../../src/utils/cache', () => ({
  clearMoodCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../src/services/moodAnalysisDataService', () => ({
  createMoodAnalysisDataService: jest.fn(() => ({
    markStaleByRecordIds: jest.fn().mockResolvedValue(undefined),
  })),
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
    const recordResult = { recordId: 10, analysisJob: null }
    mockMoodService.recordMood.mockResolvedValue(recordResult)
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
      includeNote: false,
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 1, intensity: 6 }],
      tagIds: [2],
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '记录成功', data: recordResult })
  })

  it('routes legacy mood write payloads through mood service', async () => {
    mockMoodService.listEmotionTypes.mockResolvedValue([
      { id: 3, name: 'anxious', icon: 'alert', category: 'negative' },
    ])
    mockMoodService.createOrGetTagsBatch.mockResolvedValue(new Map([['study', 8]]))
    const recordResult = { recordId: 11, analysisJob: null }
    mockMoodService.recordMood.mockResolvedValue(recordResult)
    const req = createRequest({
      body: {
        moodType: 'anxious',
        intensity: 4,
        event: 'legacy-note',
        tags: ['study'],
        trigger: 'exam',
        recordDate: '2026-07-15',
      },
    })
    const res = createResponse()

    await recordMood(req, res)

    expect(mockMoodService.listEmotionTypes).toHaveBeenCalledWith()
    expect(mockMoodService.createOrGetTagsBatch).toHaveBeenCalledWith(['study'], 1)
    expect(mockMoodService.recordMood).toHaveBeenCalledWith({
      userId: 1,
      note: 'legacy-note',
      trigger: 'exam',
      includeNote: false,
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 3, intensity: 4, isPrimary: true }],
      tagIds: [8],
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '记录成功', data: recordResult })
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

  it('returns weekly and trend DTOs without changing their content', async () => {
    const weekly = { averageIntensity: 6, dailyData: [], mostFrequentMood: '平静', summary: '平稳' }
    const trend = { labels: [], datasets: [], summary: '暂无趋势数据' }
    mockMoodService.getWeeklyReport.mockResolvedValue(weekly)
    mockMoodService.getMoodTrend.mockResolvedValue(trend)
    const weeklyResponse = createResponse()
    const trendResponse = createResponse()

    await getWeeklyReportHandler(createRequest(), weeklyResponse)
    await getMoodTrend(createRequest({ query: { range: 'month' } }), trendResponse)

    expect(mockMoodService.getWeeklyReport).toHaveBeenCalledWith(1)
    expect(mockMoodService.getMoodTrend).toHaveBeenCalledWith(1, 'month')
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
  })

  it('returns a complete delete envelope', async () => {
    mockMoodService.deleteMood.mockResolvedValue(true)
    const deleteResponse = createResponse()

    await deleteMoodHandler(createRequest({ params: { id: '10' } }), deleteResponse)

    expect(deleteResponse.json).toHaveBeenCalledWith({ code: 0, message: '删除成功', data: null })
  })

  it('routes emotion-type support data through mood service', async () => {
    const emotionTypes = [{ id: 1, name: '快乐', icon: 'smile', category: 'positive' }]
    mockMoodService.listEmotionTypes.mockResolvedValue(emotionTypes)
    const typesResponse = createResponse()

    await getMoodTypes(createRequest(), typesResponse)

    expect(mockMoodService.listEmotionTypes).toHaveBeenCalledWith()
    expect(typesResponse.json).toHaveBeenCalledWith({ code: 0, data: emotionTypes, message: '获取成功' })
  })

  it('routes emotion-type filtered list requests through mood service', async () => {
    mockMoodService.listMoods.mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 })
    const req = createRequest({ query: { emotionTypeId: '2' } })
    const res = createResponse()

    await getMoodList(req, res)

    expect(mockMoodService.listMoods).toHaveBeenCalledWith(1, {
      page: 1,
      limit: 20,
      emotionTypeId: 2,
    })
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪记录成功',
      data: { list: [], total: 0, page: 1, limit: 20 },
    })
  })
})
