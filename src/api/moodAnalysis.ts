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
}

const R0_DISABLED_MESSAGE = 'AI 情绪分析将在 v1.1 启用'

const validateMoodAnalysisRequest = (data: MoodAnalysisRequest) => {
  if (!data.content || !data.content.trim()) {
    throw new Error('情绪描述不能为空')
  }

  if (!data.mood_level || data.mood_level < 1 || data.mood_level > 10) {
    throw new Error('情绪强度必须在1-10之间')
  }
}

export const analyzeMood = async (_data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> => {
  validateMoodAnalysisRequest(_data)
  throw new Error(R0_DISABLED_MESSAGE)
}

export const debouncedAnalyzeMood = (data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> =>
  analyzeMood(data)

export const analyzeMoodWithRetry = (
  data: MoodAnalysisRequest,
  _maxRetries = 2
): Promise<MoodAnalysisResponse> => analyzeMood(data)
