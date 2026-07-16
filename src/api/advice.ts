import request from '@/utils/request'
import axios from 'axios'

export interface AdviceHistoryItem {
  id: number
  userId: number
  moodRecordId?: number
  analysis: string
  suggestions: string[]
  createdAt: string
}

export interface SaveAdviceRequest {
  moodRecordId?: number
  analysis: string
  suggestions: string[]
}

export type AdviceApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number }

const resolveAdviceError = (
  error: unknown,
  fallback: string
): { message: string; status?: number } => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ||
      (status ? `请求失败 (${status})` : fallback)
    return { message, status }
  }

  if (error instanceof Error && error.message) {
    return { message: error.message }
  }

  return { message: fallback }
}

export const saveAdvice = (data: SaveAdviceRequest) => {
  return request({
    url: '/api/moods/advice/save',
    method: 'post',
    data,
  })
}

export const saveAdviceSafe = async (data: SaveAdviceRequest): Promise<AdviceApiResult<null>> => {
  try {
    await saveAdvice(data)
    return { ok: true, data: null }
  } catch (error) {
    const { message, status } = resolveAdviceError(error, '保存建议失败，请稍后重试')
    return { ok: false, message, status }
  }
}

export const getAdviceHistory = (params?: { page?: number; pageSize?: number }) => {
  return request<{ list: AdviceHistoryItem[]; total: number }>({
    url: '/api/moods/advice/history',
    method: 'get',
    params,
  })
}

export const getAdviceHistorySafe = async (params?: {
  page?: number
  pageSize?: number
}): Promise<AdviceApiResult<{ list: AdviceHistoryItem[]; total: number }>> => {
  try {
    const data = await getAdviceHistory(params)
    return { ok: true, data }
  } catch (error) {
    const { message, status } = resolveAdviceError(error, '获取建议历史失败，请稍后重试')
    return { ok: false, message, status }
  }
}
