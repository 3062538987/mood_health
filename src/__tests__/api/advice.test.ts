import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { saveAdvice, saveAdviceSafe, getAdviceHistory, getAdviceHistorySafe } from '@/api/advice'

const requestMock = vi.mocked(request)

describe('情绪建议系统', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('保存建议', () => {
    it('成功保存建议', async () => {
      requestMock.mockResolvedValueOnce({ id: 1 })

      await saveAdvice({
        moodRecordId: 1,
        analysis: '你的情绪状态整体良好',
        suggestions: ['保持规律作息', '适当运动'],
      })

      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/moods/advice/save',
        method: 'post',
        data: {
          moodRecordId: 1,
          analysis: '你的情绪状态整体良好',
          suggestions: ['保持规律作息', '适当运动'],
        },
      })
    })

    it('saveAdviceSafe 正确处理错误', async () => {
      requestMock.mockRejectedValueOnce(new Error('网络错误'))

      const result = await saveAdviceSafe({
        analysis: '分析内容',
        suggestions: ['建议1'],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBeDefined()
      }
    })

    it('saveAdviceSafe 成功返回', async () => {
      requestMock.mockResolvedValueOnce({ id: 1 })

      const result = await saveAdviceSafe({
        analysis: '分析内容',
        suggestions: ['建议1'],
      })

      expect(result.ok).toBe(true)
    })
  })

  describe('获取建议历史', () => {
    it('默认获取历史', async () => {
      requestMock.mockResolvedValueOnce({
        list: [
          {
            id: 1,
            userId: 100,
            analysis: '情绪分析',
            suggestions: ['建议1', '建议2'],
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      })

      const result = await getAdviceHistory()

      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/moods/advice/history',
        method: 'get',
        params: undefined,
      })
    })

    it('自定义分页参数', async () => {
      requestMock.mockResolvedValueOnce({ list: [], total: 0 })

      await getAdviceHistory({ page: 2, pageSize: 5 })

      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/moods/advice/history',
        method: 'get',
        params: { page: 2, pageSize: 5 },
      })
    })

    it('getAdviceHistorySafe 正确处理错误', async () => {
      requestMock.mockRejectedValueOnce(new Error('获取失败'))

      const result = await getAdviceHistorySafe()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBeDefined()
      }
    })
  })
})