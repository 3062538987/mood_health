import request from '@/utils/request'
import {
  CreateMoodRecordInput,
  MoodRecord,
  MoodListResponse,
  MoodListParams,
  MoodWeeklyReport,
  MoodTrendResponse,
  MoodTypeEnum,
} from '@/types/mood'
import {
  getAdviceHistory,
  saveAdvice,
  type AdviceHistoryItem,
  type SaveAdviceRequest,
} from './advice'
import {
  MoodAnalysisRequest,
  MoodAnalysisResponse,
  analyzeMood,
  debouncedAnalyzeMood,
  analyzeMoodWithRetry,
} from './moodAnalysis'

export type {
  AdviceHistoryItem as MoodAdviceHistoryItem,
  MoodAnalysisRequest,
  MoodAnalysisResponse,
  SaveAdviceRequest as SaveMoodAdviceRequest,
}
export { analyzeMood, debouncedAnalyzeMood, analyzeMoodWithRetry }

export interface AnalyzeMoodRequest {
  content: string
  mood_level: number
}

export interface AnalyzeMoodResponse {
  analysis: string
  suggestions: string[]
  mood?: string
}

export const analyzeMoodLegacy = (data: AnalyzeMoodRequest) => {
  return analyzeMood(data)
}

export const analyzeMoodWithRetryLegacy = async (
  data: AnalyzeMoodRequest,
  retries = 2,
  delay = 1000
): Promise<AnalyzeMoodResponse> => {
  try {
    return await analyzeMoodLegacy(data)
  } catch (error: unknown) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return analyzeMoodWithRetryLegacy(data, retries - 1, delay * 2)
    }
    throw error
  }
}

const shouldRetry = (error: unknown): boolean => {
  const err = error as { response?: { status?: number }; code?: string; message?: string }
  if (err.response) {
    const status = err.response.status
    if (status !== undefined && (status >= 500 || status === 429)) {
      return true
    }
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return true
  }
  if (err.message && err.message.includes('Network Error')) {
    return true
  }
  return false
}

export const submitMoodRecord = (data: CreateMoodRecordInput) => {
  return request<null>({
    url: '/api/moods/record',
    method: 'post',
    data,
  })
}

export const getMoodRecordList = (params: MoodListParams) => {
  return request<MoodListResponse>({
    url: '/api/moods/list',
    method: 'get',
    params,
  })
}

export const deleteMoodRecord = (id: number): Promise<null> => {
  return request<null>({
    url: `/api/moods/${id}`,
    method: 'delete',
  })
}

export const getMoodWeeklyReport = () => {
  return request<MoodWeeklyReport>({
    url: '/api/moods/weekly-report',
    method: 'get',
  })
}

export const getMoodTypeEnum = () => {
  return request<MoodTypeEnum[]>({
    url: '/api/moods/types',
    method: 'get',
  })
}

export const getMoodTrend = (range: 'week' | 'month' | 'quarter') => {
  return request<MoodTrendResponse>({
    url: '/api/moods/trend',
    method: 'get',
    params: { range },
  })
}

export const saveMoodAdvice = (data: SaveAdviceRequest) => {
  return saveAdvice(data)
}

export const getMoodAdviceHistory = (params?: { page?: number; pageSize?: number }) => {
  return getAdviceHistory(params) as Promise<{
    list: AdviceHistoryItem[]
    total: number
  }>
}
