/**
 * 情绪分析 API
 * 调用后端 AI 上下文分析接口（DeepSeek）
 */

import request from '@/utils/request'

export interface MoodAnalysisRequest {
  content: string
  mood_level: number
}

export interface MoodAnalysisResponse {
  analysis: string
  suggestions: string[]
  mood_score?: number
  risk_level?: string
  mood: string
  /** 四段式结构化分析（可选） */
  fourSection?: {
    summary: string
    possibleCauses: string
    todayActions: string[]
    whenToSeekHelp: string
  } | null
  /** 数据范围（可选） */
  dataScope?: {
    moodRecordCount: number
    dateRange: string
    hasAssessment: boolean
    latestAssessment?: any
  } | null
}

const validateMoodAnalysisRequest = (data: MoodAnalysisRequest) => {
  if (!data.content || !data.content.trim()) {
    throw new Error('情绪描述不能为空')
  }

  if (!data.mood_level || data.mood_level < 1 || data.mood_level > 10) {
    throw new Error('情绪强度必须在1-10之间')
  }
}

/**
 * 分析情绪（调用后端 AI 上下文分析接口）
 */
export const analyzeMood = async (data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> => {
  validateMoodAnalysisRequest(data)

  const res = await request<MoodAnalysisResponse>({
    url: '/api/ai/context/analyze',
    method: 'post',
    data: {
      message: data.content,
      mood: data.mood_level,
    },
  })

  return res
}

export const debouncedAnalyzeMood = (data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> =>
  analyzeMood(data)

export const analyzeMoodWithRetry = (
  data: MoodAnalysisRequest,
  _maxRetries = 2
): Promise<MoodAnalysisResponse> => analyzeMood(data)