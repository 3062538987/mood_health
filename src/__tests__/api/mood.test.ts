import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from '@/utils/request'
import {
  getMoodRecordList,
  getMoodTrend,
  getMoodWeeklyReport,
  submitMoodRecord,
  type CreateMoodRecordInput,
} from '@/api/mood'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const requestMock = vi.mocked(request)

describe('mood API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('returns the unwrapped write result after recording a mood', async () => {
    requestMock.mockResolvedValueOnce(null)
    const payload: CreateMoodRecordInput = {
      emotions: [{ emotionTypeId: 1, intensity: 7, isPrimary: true }],
      event: '完成课程作业',
      tags: ['学习'],
      trigger: '任务完成',
      tagIds: [],
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
