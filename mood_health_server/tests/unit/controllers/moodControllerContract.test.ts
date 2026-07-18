import { Response } from 'express'
import {
  deleteMoodHandler,
  getMoodAnalysisHandler,
  getMoodList,
  getMoodTypes,
  getMoodTrend,
  getTagsHandler,
  getWeeklyReportHandler,
  createTagHandler,
  recordMood,
  updateMoodHandler,
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
  getMoodAnalysis: jest.Mock
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
      getMoodAnalysis: jest.fn(),
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

  it('returns weekly, trend and descriptive statistics DTOs without changing their content', async () => {
    const weekly = { averageIntensity: 6, dailyData: [], mostFrequentMood: '平静', summary: '平稳' }
    const trend = { labels: [], datasets: [], summary: '暂无趋势数据' }
    const statistics = { avgIntensity: 6, recordCount: 2 }
    mockMoodService.getWeeklyReport.mockResolvedValue(weekly)
    mockMoodService.getMoodTrend.mockResolvedValue(trend)
    mockMoodService.getMoodAnalysis.mockResolvedValue(statistics)
    const weeklyResponse = createResponse()
    const trendResponse = createResponse()
    const statisticsResponse = createResponse()

    await getWeeklyReportHandler(createRequest(), weeklyResponse)
    await getMoodTrend(createRequest({ query: { range: 'month' } }), trendResponse)
    await getMoodAnalysisHandler(createRequest({ query: { range: 'month' } }), statisticsResponse)

    expect(mockMoodService.getWeeklyReport).toHaveBeenCalledWith(1)
    expect(mockMoodService.getMoodTrend).toHaveBeenCalledWith(1, 'month')
    expect(mockMoodService.getMoodAnalysis).toHaveBeenCalledWith(1, 'month')
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
    mockMoodService.listEmotionTypes.mockResolvedValue([
      { id: 5, name: 'joy', icon: 'smile', category: 'positive' },
    ])
    mockMoodService.updateMood.mockResolvedValue(true)
    mockMoodService.deleteMood.mockResolvedValue(true)
    const updateResponse = createResponse()
    const deleteResponse = createResponse()

    await updateMoodHandler(
      createRequest({ params: { id: '10' }, body: { moodType: 'joy', intensity: 8 } }),
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
      includeNote: false,
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 1, intensity: 8, isPrimary: true }],
      tagIds: [2],
    })
    expect(mockMoodService.deleteMood).toHaveBeenCalledWith(1, 10)
    expect(updateResponse.json).toHaveBeenCalledWith({ code: 0, message: '更新成功', data: null })
    expect(deleteResponse.json).toHaveBeenCalledWith({ code: 0, message: '删除成功', data: null })
  })

  it('routes legacy mood update payloads through mood service', async () => {
    mockMoodService.listEmotionTypes.mockResolvedValue([
      { id: 4, name: 'calm', icon: 'leaf', category: 'positive' },
    ])
    mockMoodService.createOrGetTagsBatch.mockResolvedValue(new Map([['sleep', 6]]))
    mockMoodService.updateMood.mockResolvedValue(true)
    const res = createResponse()

    await updateMoodHandler(
      createRequest({
        params: { id: '12' },
        body: {
          moodType: 'calm',
          intensity: 7,
          note: 'legacy-update-note',
          tags: ['sleep'],
          trigger: 'rest',
          recordDate: '2026-07-15',
        },
      }),
      res
    )

    expect(mockMoodService.listEmotionTypes).toHaveBeenCalledWith()
    expect(mockMoodService.createOrGetTagsBatch).toHaveBeenCalledWith(['sleep'], 1)
    expect(mockMoodService.updateMood).toHaveBeenCalledWith({
      id: 12,
      userId: 1,
      note: 'legacy-update-note',
      trigger: 'rest',
      includeNote: false,
      recordedAt: new Date('2026-07-15T00:00:00.000Z'),
      emotions: [{ emotionTypeId: 4, intensity: 7, isPrimary: true }],
      tagIds: [6],
    })
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '更新成功', data: null })
  })

  it('routes emotion type and tag support data through mood service', async () => {
    const emotionTypes = [{ id: 1, name: '快乐', icon: 'smile', category: 'positive' }]
    const tags = [{ id: 2, name: '学习', user_id: null, is_system: true }]
    mockMoodService.listEmotionTypes.mockResolvedValue(emotionTypes)
    mockMoodService.listTags.mockResolvedValue(tags)
    mockMoodService.createOrGetTag.mockResolvedValue({ id: 9, name: '新标签' })
    const typesResponse = createResponse()
    const tagsResponse = createResponse()
    const createTagResponse = createResponse()

    await getMoodTypes(createRequest(), typesResponse)
    await getTagsHandler(createRequest(), tagsResponse)
    await createTagHandler(createRequest({ body: { name: ' 新标签 ' } }), createTagResponse)

    expect(mockMoodService.listEmotionTypes).toHaveBeenCalledWith()
    expect(mockMoodService.listTags).toHaveBeenCalledWith(1)
    expect(mockMoodService.createOrGetTag).toHaveBeenCalledWith('新标签', 1)
    expect(typesResponse.json).toHaveBeenCalledWith({ code: 0, data: emotionTypes, message: '获取成功' })
    expect(tagsResponse.json).toHaveBeenCalledWith({ code: 0, data: tags, message: '获取成功' })
    expect(createTagResponse.status).toHaveBeenCalledWith(201)
    expect(createTagResponse.json).toHaveBeenCalledWith({
      code: 0,
      data: { id: 9, name: '新标签' },
      message: '创建成功',
    })
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
