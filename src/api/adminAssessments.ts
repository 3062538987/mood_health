/**
 * 管理端测评会话 API
 * 对应后端 managementRoutes：GET /api/admin/assessments（列表）、GET /api/admin/assessments/:id（详情）
 * 权限：user.manage
 */

import request from '@/utils/request'

export interface AdminAssessmentListItem {
  id: number
  userId: number
  username: string | null
  instrumentName: string
  rawScore: number
  screeningLevel: string
  status: string
  startedAt: string
  submittedAt: string
}

export interface AdminAssessmentListResult {
  list: AdminAssessmentListItem[]
  total: number
  page: number
  pageSize: number
}

export interface AdminAssessmentAnswer {
  itemId: number
  itemText: string
  answerValue: unknown
  score: number
}

export interface AdminAssessmentDetail {
  id: number
  userId: number
  username: string | null
  instrumentName: string
  versionLabel: string
  rawScore: number
  screeningLevel: string
  resultSummary: Record<string, unknown>
  answers: AdminAssessmentAnswer[]
  startedAt: string
  submittedAt: string
}

export interface AdminAssessmentQuery {
  page?: number
  pageSize?: number
  userId?: number
  instrumentId?: number
  riskLevel?: string
  startDate?: string
  endDate?: string
}

export const getAdminAssessments = (params: AdminAssessmentQuery) =>
  request<AdminAssessmentListResult>({
    url: '/api/admin/assessments',
    method: 'get',
    params,
  })

export const getAdminAssessmentDetail = (id: number) =>
  request<AdminAssessmentDetail>({
    url: `/api/admin/assessments/${id}`,
    method: 'get',
  })
