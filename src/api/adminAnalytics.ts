/**
 * 管理端数据分析 API
 */

import request from '@/utils/request'

export interface KpiStats {
  totalUsers: number
  newUsers: number
  totalMoodRecords: number
  moodRecordUsers: number
  totalAssessments: number
  assessmentUsers: number
  totalPosts: number
  pendingPosts: number
  totalActivities: number
  activityParticipants: number
  totalAiCalls: number
  aiUsers: number
  totalRelaxSessions: number
}

export interface MoodTrendItem {
  date: string
  count: number
  avgIntensity: number
}

export interface MoodDistributionItem {
  type: string
  count: number
}

export interface AssessmentDistribution {
  instruments: Array<{ id: number; name: string; count: number }>
  scoreRanges: Array<{ range: string; count: number }>
  riskLevels: Array<{ level: string; count: number }>
}

export interface ModuleUsageItem {
  name: string
  metric: string
  count: number
  description: string
}

export const fetchKpiStats = async (startDate?: string, endDate?: string): Promise<KpiStats> => {
  const response = await request<KpiStats>({
    url: '/api/admin/kpi',
    method: 'get',
    params: { startDate, endDate },
  })
  return response
}

export const fetchMoodTrend = async (startDate: string, endDate: string, granularity: 'day' | 'week' = 'day'): Promise<MoodTrendItem[]> => {
  const response = await request<MoodTrendItem[]>({
    url: '/api/admin/analytics/mood-trend',
    method: 'get',
    params: { startDate, endDate, granularity },
  })
  return response
}

export const fetchMoodDistribution = async (startDate: string, endDate: string): Promise<MoodDistributionItem[]> => {
  const response = await request<MoodDistributionItem[]>({
    url: '/api/admin/analytics/mood-distribution',
    method: 'get',
    params: { startDate, endDate },
  })
  return response
}

export const fetchAssessmentDistribution = async (startDate: string, endDate: string, instrumentId?: number): Promise<AssessmentDistribution> => {
  const response = await request<AssessmentDistribution>({
    url: '/api/admin/analytics/assessment-distribution',
    method: 'get',
    params: { startDate, endDate, instrumentId },
  })
  return response
}

export const fetchModuleUsage = async (startDate: string, endDate: string): Promise<ModuleUsageItem[]> => {
  const response = await request<ModuleUsageItem[]>({
    url: '/api/admin/analytics/module-usage',
    method: 'get',
    params: { startDate, endDate },
  })
  return response
}