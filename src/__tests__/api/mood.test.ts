import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeMood, analyzeMoodWithRetry } from '@/api/mood'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

import axios from 'axios'

describe('analyzeMood', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return analysis result on successful request', async () => {
    const mockResponse = {
      data: {
        analysis: '用户情绪积极，工作成就感强',
        suggestions: ['继续保持积极的工作态度', '适当奖励自己的努力'],
      },
    }

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    const result = await analyzeMood({
      content: '今天心情很好',
      mood_level: 5,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(result.analysis).toBe('用户情绪积极，工作成就感强')
    expect(result.suggestions).toHaveLength(2)
    expect(axios.post).toHaveBeenCalledWith(
      '/ai/analyze-mood',
      { content: '今天心情很好', mood_level: 5 },
      { timeout: 30000 }
    )
  })

  it('should throw error when request fails', async () => {
    const mockError = new Error('Network Error')
    vi.mocked(axios.post).mockRejectedValueOnce(mockError)

    await expect(analyzeMood({ content: '测试内容', mood_level: 3 })).rejects.toThrow(
      'Network Error'
    )
  })

  it('should handle timeout correctly', async () => {
    const mockError = new Error('timeout') as Error & { code?: string }
    mockError.code = 'ECONNABORTED'
    vi.mocked(axios.post).mockRejectedValueOnce(mockError)

    await expect(analyzeMood({ content: '测试内容', mood_level: 3 })).rejects.toThrow()
  })

  it('should call API with correct parameters', async () => {
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
      },
    }

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    await analyzeMood({
      content: '今天感到有些焦虑',
      mood_level: 2,
    })

    expect(axios.post).toHaveBeenCalledWith(
      '/ai/analyze-mood',
      expect.objectContaining({
        content: '今天感到有些焦虑',
        mood_level: 2,
      }),
      expect.objectContaining({
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

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    const result = await analyzeMoodWithRetry({
      content: '测试内容',
      mood_level: 3,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(axios.post).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const mockError = new Error('Network Error')
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
      },
    }

    vi.mocked(axios.post).mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockResponse)

    const result = await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 2)

    expect(result).toHaveProperty('analysis')
    expect(axios.post).toHaveBeenCalledTimes(2)
  })

  it('should throw error after all retries fail', async () => {
    const mockError = new Error('Network Error')
    vi.mocked(axios.post).mockRejectedValue(mockError)

    await expect(analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 2)).rejects.toThrow(
      'Network Error'
    )

    expect(axios.post).toHaveBeenCalledTimes(3)
  })

  it('should not retry on successful response', async () => {
    const mockResponse = {
      data: {
        analysis: '分析结果',
        suggestions: ['建议1'],
      },
    }

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse)

    await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 3)

    expect(axios.post).toHaveBeenCalledTimes(1)
  })
})
