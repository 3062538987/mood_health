import request from '@/utils/request'
import type {
  AnalysisPeriod,
  AnalysisStatus,
  AiAnalysisResult,
  AnalysisJob,
  AnalysisHistoryItem,
  AnalysisDataScope,
} from '@/types/moodAnalysis'

export interface MoodAnalysisRequest {
  content: string
  mood_level: number
}

export interface MoodAnalysisResponse {
  analysis: string
  suggestions: string[]
  mood?: string
}

export interface CreateAnalysisParams {
  period: AnalysisPeriod
  dataScope?: AnalysisDataScope
  useJournal?: boolean
}

export interface AnalysisResponse {
  id: string
  period: AnalysisPeriod
  status: AnalysisStatus
  result?: AiAnalysisResult
  job?: AnalysisJob
  createdAt: string
  updatedAt: string
}

const validateMoodAnalysisRequest = (data: MoodAnalysisRequest): void => {
  if (!data.content || !data.content.trim()) {
    throw new Error('情绪描述不能为空')
  }
  if (data.mood_level < 1 || data.mood_level > 10) {
    throw new Error('情绪强度必须在1-10之间')
  }
}

export const analyzeMood = async (data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> => {
  validateMoodAnalysisRequest(data)
  return request<MoodAnalysisResponse>({
    url: '/api/ai/context/analyze',
    method: 'post',
    data: {
      message: data.content,
      mood: data.mood_level,
    },
  })
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const debouncedAnalyzeMood = async (
  data: MoodAnalysisRequest,
  delay: number = 300
): Promise<MoodAnalysisResponse> => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  return new Promise((resolve, reject) => {
    debounceTimer = setTimeout(async () => {
      try {
        const result = await analyzeMood(data)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

export const analyzeMoodWithRetry = async (
  data: MoodAnalysisRequest,
  retries: number = 2,
  delay: number = 1000
): Promise<MoodAnalysisResponse> => {
  try {
    return await analyzeMood(data)
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return analyzeMoodWithRetry(data, retries - 1, delay * 2)
    }
    throw error
  }
}

const shouldRetry = (error: any): boolean => {
  if (error.response) {
    const status = error.response.status
    return status >= 500 || status === 429
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true
  }
  if (error.message && error.message.includes('Network Error')) {
    return true
  }
  return false
}

export const createAnalysis = (params: CreateAnalysisParams) => {
  return request<AnalysisResponse>({
    url: '/api/mood-analyses',
    method: 'post',
    data: params,
  })
}

export const getAnalysis = (id: string) => {
  return request<AnalysisResponse>({
    url: `/api/mood-analyses/${id}`,
    method: 'get',
  })
}

export const getAnalysisStatus = (id: string) => {
  return request<{ status: AnalysisStatus; job?: AnalysisJob }>({
    url: `/api/mood-analyses/${id}`,
    method: 'get',
  })
}

export const getAnalysisHistory = (params?: {
  period?: string
  page?: number
  pageSize?: number
}) => {
  return request<{
    data: AnalysisHistoryItem[]
    total: number
    page: number
    pageSize: number
  }>({
    url: '/api/mood-analyses',
    method: 'get',
    params,
  })
}

export const deleteAnalysis = (id: string) => {
  return request<void>({
    url: `/api/mood-analyses/${id}`,
    method: 'delete',
  })
}

export const retryAnalysis = (id: string) => {
  return request<AnalysisResponse>({
    url: `/api/mood-analyses/${id}`,
    method: 'post',
  })
}

export const getLatestAnalysis = (period: AnalysisPeriod) => {
  return request<AnalysisResponse | null>({
    url: '/api/mood-analyses/latest',
    method: 'get',
    params: { period },
  })
}