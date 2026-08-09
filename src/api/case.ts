import request from '@/utils/request'

export type CaseStatus = 'open' | 'assigned' | 'in_progress' | 'referred' | 'closed'
export type InterventionType = 'note' | 'interview' | 'referral' | 'closure'

export interface CaseItem {
  id: number
  studentUserId: number
  assignedCounselorId: number | null
  sourceSessionId: number | null
  status: CaseStatus
  riskLevel: string | null
  summary: string | null
  createdAt: string
  updatedAt: string
}

export interface CaseIntervention {
  id: number
  caseId: number
  counselorUserId: number
  interventionType: InterventionType
  content: string
  referralTarget: string | null
  referralReason: string | null
  closureSummary: string | null
  createdAt: string
}

export interface CaseDetail {
  case: CaseItem
  interventions: CaseIntervention[]
}

export interface CreateCaseInput {
  studentUserId: number
  riskLevel?: string
  summary?: string
}

export interface AssignCaseInput {
  counselorId: number
}

export interface AddInterventionInput {
  interventionType: InterventionType
  content: string
}

export interface ReferCaseInput {
  reason: string
  target: string
}

export interface CloseCaseInput {
  summary: string
}

export const getMyCases = () => {
  return request<CaseItem[]>({
    url: '/api/cases',
    method: 'get',
  })
}

export const getCaseDetail = (id: number) => {
  return request<CaseDetail>({
    url: `/api/cases/${id}`,
    method: 'get',
  })
}

export const createCase = (data: CreateCaseInput) => {
  return request<CaseItem>({
    url: '/api/cases',
    method: 'post',
    data,
  })
}

export const assignCase = (id: number, data: AssignCaseInput) => {
  return request<CaseItem>({
    url: `/api/cases/${id}/assign`,
    method: 'put',
    data,
  })
}

export const addIntervention = (id: number, data: AddInterventionInput) => {
  return request<CaseIntervention>({
    url: `/api/cases/${id}/interventions`,
    method: 'post',
    data,
  })
}

export const referCase = (id: number, data: ReferCaseInput) => {
  return request<CaseItem>({
    url: `/api/cases/${id}/refer`,
    method: 'put',
    data,
  })
}

export const closeCase = (id: number, data: CloseCaseInput) => {
  return request<CaseItem>({
    url: `/api/cases/${id}/close`,
    method: 'put',
    data,
  })
}
