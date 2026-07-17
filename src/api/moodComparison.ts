import request from '@/utils/request'

export interface PeriodData {
  count: number
  avgIntensity: number
}

export interface MoodComparison {
  thisPeriod: PeriodData
  lastPeriod: PeriodData
  change: {
    countRate: number
    intensityDiff: number
  }
  changeDescription: string
}

export function fetchMoodComparison(period: 'week' | 'month'): Promise<MoodComparison> {
  return request<MoodComparison>({
    url: '/api/moods/comparison',
    method: 'get',
    params: { period },
  })
}