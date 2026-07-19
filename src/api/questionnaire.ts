import request from '@/utils/request'

export interface Questionnaire {
  id: number
  title: string
  description: string
  type: string
  created_at: string
}

export interface Question {
  id: number
  questionnaire_id: number
  question_text: string
  question_type: string
  options: string[]
  sort_order: number
  is_reverse: boolean
}

export interface AssessmentResult {
  score: number
  result_text: string
  screening_type: string
  risk_level: 'low' | 'mild' | 'moderate' | 'high' | 'unclassified'
  disclaimer: string
}

export interface AssessmentAnswer {
  itemId: number
  score: number
}

export interface AssessmentAnswers {
  questionnaire_id: number
  answers: AssessmentAnswer[]
}

export interface AssessmentHistory {
  id: number
  user_id: number
  questionnaire_id: number
  score: number
  result_text: string
  created_at: string
  title: string
  type: string
}

export const getQuestionnaires = () => {
  return request<Questionnaire[]>({
    url: '/api/questionnaires',
    method: 'get',
  })
}

export const getQuestionnaireDetail = (id: number) => {
  return request<Questionnaire>({
    url: `/api/questionnaires/${id}`,
    method: 'get',
  })
}

export const getQuestionnaireQuestions = (id: number) => {
  return request<Question[]>({
    url: `/api/questionnaires/${id}/questions`,
    method: 'get',
  })
}

export const submitAssessment = (data: AssessmentAnswers) => {
  return request<AssessmentResult>({
    url: '/api/questionnaires/assessments',
    method: 'post',
    data,
  })
}

export const getAssessmentHistory = () => {
  return request<AssessmentHistory[]>({
    url: '/api/questionnaires/history',
    method: 'get',
  })
}

/**
 * 获取 AI 量表解读
 */
export function getAIInterpretation(data: {
  scaleType: string
  totalScore: number
  itemScores: number[]
  resultText: string
}) {
  return request.post('/api/ai/interpret', data)
}
