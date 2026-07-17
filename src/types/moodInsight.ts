export interface InsightSummary {
  totalDays: number
  totalRecords: number
  mainEmotion: string
  mainEmotionCode: string
  avgIntensity: number
}

export interface DistributionItem {
  name: string
  code: string
  icon: string
  count: number
  percent: number
  color: string
}

export interface TrendItem {
  date: string
  avgIntensity: number
  dominantEmotion: string
  recordCount: number
}

export interface Polarity {
  positive: number
  neutral: number
  negative: number
}

export interface PeriodComparisonItem {
  label: string
  positive: number
  neutral: number
  negative: number
}

export interface MoodInsightResponse {
  summary: InsightSummary
  distribution: DistributionItem[]
  trend: TrendItem[]
  polarity: Polarity
  periodComparison: PeriodComparisonItem[]
}

export interface AiInsightResponse {
  analysis: string
}

export type InsightPeriod = 'day' | 'week' | 'month' | 'year'