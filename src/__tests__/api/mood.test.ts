import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeMood, analyzeMoodWithRetry } from '@/api/mood'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

import request from '@/utils/request'

describe('analyzeMood', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return analysis result on successful request', async () => {
    const mockResponse = {
      data: {
        analysis: '用户情绪积极，工作成就感强',
        suggestions: ['继续保持积极的工作态度', '适当奖励自己的努力'],
        mood: '开心',
      },
    }

    vi.mocked(request).mockResolvedValueOnce(mockResponse.data)

    const result = await analyzeMood({
      content: '今天心情很好',
      mood_level: 5,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(result.analysis).toBe('用户情绪积极，工作成就感强')
    expect(result.suggestions).toHaveLength(2)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ai/analyze-mood',
        method: 'post',
        data: { content: '今天心情很好', mood_level: 5 },
      })
    )
  })

  it('should return local fallback when request fails', async () => {
    const mockError = new Error('Network Error')
    vi.mocked(request).mockRejectedValueOnce(mockError)

    const result = await analyzeMood({ content: '测试内容', mood_level: 3 })
    expect(result.mood).toBe('平静')
  })

  it('should handle timeout with fallback correctly', async () => {
    const mockError = new Error('timeout') as Error & { code?: string }
    mockError.code = 'ECONNABORTED'
    vi.mocked(request).mockRejectedValueOnce(mockError)

    const result = await analyzeMood({ content: '测试内容', mood_level: 3 })
    expect(result.mood).toBe('平静')
  })

  it('should call API with correct parameters', async () => {
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
      },
    }

    vi.mocked(request).mockResolvedValueOnce(mockResponse.data)

    await analyzeMood({
      content: '今天感到有些焦虑',
      mood_level: 2,
    })

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/ai/analyze-mood',
        method: 'post',
        data: {
          content: '今天感到有些焦虑',
          mood_level: 2,
        },
        timeout: 30000,
      })
    )
  })
})

describe('analyzeMoodWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return result on first successful attempt', async () => {
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1', '建议2'],
      },
    }

    vi.mocked(request).mockResolvedValueOnce(mockResponse.data)

    const result = await analyzeMoodWithRetry({
      content: '测试内容',
      mood_level: 3,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('should return fallback on first failure without retrying', async () => {
    const mockError = new Error('Network Error')
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
        mood: '平静',
      },
    }

    vi.mocked(request).mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockResponse.data)

    const result = await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 2)

    expect(result).toHaveProperty('analysis')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('should return fallback after all retries fail', async () => {
    const mockError = new Error('Network Error')
    vi.mocked(request).mockRejectedValue(mockError)

    const result = await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 2)
    expect(result.mood).toBe('平静')

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('should not retry on successful response', async () => {
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
      },
    }

    vi.mocked(request).mockResolvedValueOnce(mockResponse.data)

    await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 3)

    expect(request).toHaveBeenCalledTimes(1)
  })
})
