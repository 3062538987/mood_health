import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { fetchAiHistoryList, fetchAiHistoryDetail } from '@/api/aiHistory'
import type { AiHistoryListResponse, AiHistoryDetail } from '@/api/aiHistory'

const requestMock = vi.mocked(request)

describe('AI 分析历史记录', () => {
  describe('获取历史列表', () => {
    it('默认分页获取历史列表', async () => {
      requestMock.mockResolvedValueOnce({
        list: [
          {
            id: 1,
            analysisType: 'counseling',
            riskLevel: 'low',
            requestStatus: 'completed',
            analysisSummary: '用户表达了工作压力...',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      } satisfies AiHistoryListResponse)

      const result = await fetchAiHistoryList()

      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/ai/history',
        method: 'get',
        params: { page: 1, pageSize: 20 },
      })
    })

    it('自定义分页参数', async () => {
      requestMock.mockResolvedValueOnce({
        list: [],
        total: 0,
        page: 2,
        pageSize: 10,
      })

      await fetchAiHistoryList(2, 10)

      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/ai/history',
        method: 'get',
        params: { page: 2, pageSize: 10 },
      })
    })

    it('空列表返回', async () => {
      requestMock.mockResolvedValueOnce({
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
      })

      const result = await fetchAiHistoryList()

      expect(result.list).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('获取历史详情', () => {
    it('成功获取详情', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1,
        userId: 100,
        moodRecordId: null,
        assessmentSessionId: null,
        analysisType: 'counseling',
        inputContext: { message: '我最近压力很大' },
        analysisContent: {
          summary: '用户表达了工作压力',
          possibleCauses: '工作负担过重',
          todayActions: ['适当休息', '和朋友交流'],
          whenToSeekHelp: '如果持续两周以上',
        },
        suggestionContent: null,
        riskLevel: 'low',
        modelVersion: null,
        requestStatus: 'completed',
        errorMessage: null,
        createdAt: '2026-01-01T00:00:00Z',
      } satisfies AiHistoryDetail)

      const result = await fetchAiHistoryDetail(1)

      expect(result.id).toBe(1)
      expect(result.analysisType).toBe('counseling')
      expect(result.analysisContent.summary).toBeDefined()
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/ai/history/1',
        method: 'get',
      })
    })
  })
})