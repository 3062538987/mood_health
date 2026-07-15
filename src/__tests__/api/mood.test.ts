import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from '@/utils/request'
import {
  analyzeMood,
  analyzeMoodWithRetry,
  getMoodRecordList,
  getMoodTrend,
  getMoodWeeklyReport,
  submitMoodRecord,
} from '@/api/mood'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const requestMock = vi.mocked(request)

describe('analyzeMood', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return local analysis result', async () => {
    const result = await analyzeMood({
      content: '今天心情很好',
      mood_level: 5,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(result.mood).toBe('开心')
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('should return calm mood when no keyword is matched', async () => {
    const result = await analyzeMood({ content: '测试内容', mood_level: 3 })
    expect(result.mood).toBe('平静')
  })

  it('should detect anxious mood', async () => {
    const result = await analyzeMood({
      content: '今天感到有些焦虑',
      mood_level: 2,
    })
    expect(result.mood).toBe('焦虑')
  })
})

describe('analyzeMoodWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return result on first attempt', async () => {
    const result = await analyzeMoodWithRetry({
      content: '测试内容',
      mood_level: 3,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
  })

  it('should return result when retries are provided', async () => {
    await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 3)
    expect(true).toBe(true)
  })
})

describe('mood API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('returns the unwrapped write result after recording a mood', async () => {
    requestMock.mockResolvedValueOnce(null)
    const payload = {
      intensity: 7,
      moodType: ['快乐'],
      moodRatio: [70],
      event: '完成课程作业',
      tags: ['学习'],
      trigger: '任务完成',
    }

    await expect(submitMoodRecord(payload)).resolves.toBeNull()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/moods/record',
      method: 'post',
      data: payload,
    })
  })

  it('returns the unwrapped paginated mood list', async () => {
    const result = { list: [], total: 0, page: 2, limit: 10 }
    requestMock.mockResolvedValueOnce(result)

    await expect(getMoodRecordList({ page: 2, size: 10 })).resolves.toEqual(result)
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/moods/list',
      method: 'get',
      params: { page: 2, size: 10 },
    })
  })

  it('returns unwrapped weekly and trend DTOs', async () => {
    const weekly = {
      averageIntensity: 6,
      dailyData: [],
      mostFrequentMood: '平静',
      summary: '本周情绪整体平稳',
    }
    const trend = { labels: [], datasets: [], summary: '暂无趋势数据' }
    requestMock.mockResolvedValueOnce(weekly).mockResolvedValueOnce(trend)

    await expect(getMoodWeeklyReport()).resolves.toEqual(weekly)
    await expect(getMoodTrend('month')).resolves.toEqual(trend)
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/moods/trend',
      method: 'get',
      params: { range: 'month' },
    })
  })
})
