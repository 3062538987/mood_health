import request from '@/utils/request'

export interface InterpretationItem {
  label: string
  score: number
}

export interface InterpretationInput {
  scaleName: string
  scaleType: string
  totalScore: number
  maxScore: number
  itemScores: InterpretationItem[]
  riskLevel: string
}

export interface InterpretationResult {
  content: string
  generatedAt: string
}

export interface MoodReportInput {
  userName: string
  dateRange: string
  recordCount: number
  primaryEmotions: string
  averageIntensity: number
  mostFrequentMood: string
  trend?: string
  highlights?: string
  lowPoints?: string
  emotionDistribution?: string
  type: 'weekly' | 'monthly'
}

export interface MoodReportResult {
  content: string
  generatedAt: string
}

export const getInterpretation = (data: InterpretationInput) => {
  return request<InterpretationResult>({
    url: '/api/ai/interpret',
    method: 'post',
    data,
  })
}

export const getMoodReport = (data: MoodReportInput) => {
  return request<MoodReportResult>({
    url: '/api/ai/report',
    method: 'post',
    data,
  })
}