import { describe, expect, it, vi } from 'vitest'

// Mock request 模块，避免真实 HTTP 调用
vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

import request from '@/utils/request'
import { analyzeMood, debouncedAnalyzeMood } from '@/api/moodAnalysis'

const requestMock = vi.mocked(request)

describe('R0 mood analysis boundary', () => {
  it('rejects empty mood text before any analysis request', async () => {
    await expect(analyzeMood({ content: '', mood_level: 5 })).rejects.toThrow('情绪描述不能为空')
  })

  it('rejects an invalid self-reported intensity', async () => {
    await expect(analyzeMood({ content: '测试内容', mood_level: 11 })).rejects.toThrow(
      '情绪强度必须在1-10之间'
    )
  })

  it('sends valid mood analysis request to the backend', async () => {
    requestMock.mockResolvedValueOnce({
      analysis: '分析结果',
      suggestions: ['建议1', '建议2'],
      mood: '兴奋',
    })

    const result = await analyzeMood({ content: '我今天感到很兴奋', mood_level: 7 })

    expect(result.mood).toBe('兴奋')
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/context/analyze',
      method: 'post',
      data: {
        message: '我今天感到很兴奋',
        mood: 7,
      },
    })
  })

  it('settles every caller with the latest result when debounce calls are coalesced', async () => {
    vi.useFakeTimers()
    requestMock.mockReset()
    requestMock.mockResolvedValueOnce({ analysis: 'latest', suggestions: [] })

    const first = debouncedAnalyzeMood({ content: 'first', mood_level: 3 }, 100)
    const second = debouncedAnalyzeMood({ content: 'second', mood_level: 7 }, 100)
    await vi.advanceTimersByTimeAsync(100)

    await expect(Promise.all([first, second])).resolves.toEqual([
      { analysis: 'latest', suggestions: [] },
      { analysis: 'latest', suggestions: [] },
    ])
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { message: 'second', mood: 7 },
    }))
    vi.useRealTimers()
  })
})
