import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { submitAiFeedback } from '@/api/feedback'

const requestMock = vi.mocked(request)

describe('AI 建议反馈接口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('提交反馈时使用正确的后端路径 /api/feedback', async () => {
    requestMock.mockResolvedValueOnce({ id: 1 })

    await submitAiFeedback({ analysisHistoryId: 1, feedbackType: 'helpful' })

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/feedback',
      method: 'post',
      data: { analysisHistoryId: 1, feedbackType: 'helpful' },
    })
  })

  it('回归保护：不得指向不存在的 /api/ai/feedback', async () => {
    requestMock.mockResolvedValueOnce({ id: 2 })

    const result = await submitAiFeedback({ analysisHistoryId: 2, feedbackType: 'not_helpful' })

    const arg = requestMock.mock.calls[0][0]
    expect(arg.url).toBe('/api/feedback')
    expect(arg.url).not.toBe('/api/ai/feedback')
    expect(result.id).toBe(2)
  })
})
