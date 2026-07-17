import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { fetchMoodComparison } from '@/api/moodComparison'
import type { MoodComparison } from '@/api/moodComparison'

const requestMock = vi.mocked(request)

describe('情绪对比分析', () => {
  it('获取周对比数据', async () => {
    requestMock.mockResolvedValueOnce({
      thisPeriod: { count: 7, avgIntensity: 6.5 },
      lastPeriod: { count: 5, avgIntensity: 5.8 },
      change: { countRate: 0.4, intensityDiff: 0.7 },
      changeDescription: '本周情绪记录次数增加40%，平均强度提升0.7',
    } satisfies MoodComparison)

    const result = await fetchMoodComparison('week')

    expect(result.thisPeriod.count).toBe(7)
    expect(result.lastPeriod.avgIntensity).toBe(5.8)
    expect(result.change.intensityDiff).toBe(0.7)
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/moods/comparison',
      method: 'get',
      params: { period: 'week' },
    })
  })

  it('获取月对比数据', async () => {
    requestMock.mockResolvedValueOnce({
      thisPeriod: { count: 30, avgIntensity: 6.2 },
      lastPeriod: { count: 28, avgIntensity: 6.0 },
      change: { countRate: 0.07, intensityDiff: 0.2 },
      changeDescription: '本月情绪记录次数增加7%，平均强度基本持平',
    } satisfies MoodComparison)

    const result = await fetchMoodComparison('month')

    expect(result.thisPeriod.count).toBe(30)
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/moods/comparison',
      method: 'get',
      params: { period: 'month' },
    })
  })
})