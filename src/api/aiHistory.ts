/**
 * AI 分析历史 API
 */

import { request } from '@/utils/request'

export interface AiHistoryItem {
  id: number
  analysisType: string
  riskLevel: string
  requestStatus: string
  analysisSummary: string
  createdAt: string
}

export interface AiHistoryDetail {
  id: number
  userId: number
  moodRecordId: number | null
  assessmentSessionId: number | null
  analysisType: string
  inputContext: unknown
  analysisContent: {
    summary: string
    possibleCauses: string
    todayActions: string[]
    whenToSeekHelp: string
  }
  suggestionContent: unknown
  riskLevel: string
  modelVersion: string | null
  requestStatus: string
  errorMessage: string | null
  createdAt: string
}

export interface AiHistoryListResponse {
  list: AiHistoryItem[]
  total: number
  page: number
  pageSize: number
}

export const fetchAiHistoryList = async (page = 1, pageSize = 20): Promise<AiHistoryListResponse> => {
  const response = await request<AiHistoryListResponse>({
    url: '/api/ai/history',
    method: 'get',
    params: { page, pageSize },
  })
  return response
}

export const fetchAiHistoryDetail = async (id: number): Promise<AiHistoryDetail> => {
  const response = await request<AiHistoryDetail>({
    url: `/api/ai/history/${id}`,
    method: 'get',
  })
  return response
}