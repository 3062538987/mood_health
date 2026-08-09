import request from '@/utils/request'

export interface SubmitAiFeedbackPayload {
  analysisHistoryId: number
  feedbackType: 'helpful' | 'not_helpful'
  comment?: string
}

export interface SubmitAiFeedbackResult {
  id: number
}

/**
 * 提交对 AI 情绪分析建议的反馈。
 * 注意：后端路由挂载在 /api/feedback（feedbackRoutes 挂在 /api 下），
 * 而不是 /api/ai/feedback —— 后者在当前后端源码中并不存在（会 404）。
 */
export const submitAiFeedback = (payload: SubmitAiFeedbackPayload) => {
  return request<SubmitAiFeedbackResult>({
    url: '/api/feedback',
    method: 'post',
    data: payload,
  })
}
