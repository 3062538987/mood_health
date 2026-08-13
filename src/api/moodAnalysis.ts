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

export interface MoodInsightResponse {
  data?: {
    content: string
    trend?: Array<{ label: string; level: number }>
  }
  content: string
  trend?: Array<{ label: string; level: number }>
  suggestions?: string[]
  [key: string]: unknown
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
let debouncedMoodInput: MoodAnalysisRequest | null = null
let debounceWaiters: Array<{
  resolve: (value: MoodAnalysisResponse) => void
  reject: (reason?: unknown) => void
}> = []

export const debouncedAnalyzeMood = async (
  data: MoodAnalysisRequest,
  delay: number = 300
): Promise<MoodAnalysisResponse> => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debouncedMoodInput = data

  return new Promise((resolve, reject) => {
    debounceWaiters.push({ resolve, reject })
    debounceTimer = setTimeout(() => {
      const input = debouncedMoodInput
      const waiters = debounceWaiters
      debounceTimer = null
      debouncedMoodInput = null
      debounceWaiters = []

      if (!input) {
        const error = new Error('缺少待分析的情绪内容')
        waiters.forEach((waiter) => waiter.reject(error))
        return
      }

      void analyzeMood(input).then(
        (result) => waiters.forEach((waiter) => waiter.resolve(result)),
        (error) => waiters.forEach((waiter) => waiter.reject(error))
      )
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
  } catch (error: unknown) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return analyzeMoodWithRetry(data, retries - 1, delay * 2)
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

// 注意：后端在「该周期内无情绪记录」(NO_RECORDS) 时返回 apiSuccess(null)，
// 因此此处返回类型必须允许 null，调用方需做空值守卫，避免 created.id 崩溃。
export const createAnalysis = (params: CreateAnalysisParams) => {
  return request<AnalysisResponse | null>({
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
    // 触发分析会同步阻塞等待 AI（后端最长约 60s），必须放宽超时，
    // 否则默认 10s 会把请求砍掉，导致前端永远拿不到结果。
    timeout: 70000,
  })
}

export const getLatestAnalysis = (period: AnalysisPeriod) => {
  return request<AnalysisResponse | null>({
    url: '/api/mood-analyses/latest',
    method: 'get',
    params: { period },
  })
}

/**
 * 获取 AI 情绪洞察
 */
export function getMoodInsight(data: { period: string }) {
  return request<MoodInsightResponse>({
    url: '/api/ai/insight',
    method: 'post',
    data,
  })
}
