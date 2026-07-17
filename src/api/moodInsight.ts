import request from '@/utils/request'
import type { MoodInsightResponse, AiInsightResponse, InsightPeriod } from '@/types/moodInsight'

export const getMoodInsight = (period: InsightPeriod) => {
  return request<MoodInsightResponse>({
    url: '/api/moods/insight',
    method: 'get',
    params: { period },
  })
}

export const getAiInsight = (period: InsightPeriod, insightData: MoodInsightResponse) => {
  return request<AiInsightResponse>({
    url: '/api/ai/insight',
    method: 'post',
    data: { period, insightData },
  })
}