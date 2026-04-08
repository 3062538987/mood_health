import request from '@/utils/request'

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: UserRole
  createdAt: string
}

export interface AdminPost {
  id: number
  title: string
  content: string
  status: number
  auditRemark?: string | null
  createdAt?: string
}

export interface AdminCourse {
  id: number
  title: string
  description?: string
  content?: string
  coverUrl?: string
  category?: string
  type?: string
  updatedAt?: string
}

export interface AdminMusic {
  id: number
  title: string
  artist?: string
  updatedAt?: string
}

export interface AdminAuditLog {
  id: number
  operatorId?: number | null
  operatorRole?: string
  permissionCode?: string
  operationType?: string
  targetId?: string | null
  operationResult?: string
  operationTime?: string
}

export interface AdminMoodRecord {
  id: number
  userId: number
  username: string
  moodType: string[]
  intensity: number
  note: string
  trigger: string
  createdAt: string
}

export interface AdminMoodListResponse {
  list: AdminMoodRecord[]
  total: number
  page: number
  pageSize: number
}

export interface AdminMoodListParams {
  page?: number
  pageSize?: number
  userId?: number
  username?: string
  startDate?: string
  endDate?: string
  emotions?: string[]
  moodType?: string
}

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const response = await request<{ list: AdminUser[] }>({
    url: '/api/admin/users',
    method: 'get',
  })

  return Array.isArray(response.list) ? response.list : []
}

export const updateAdminUserRole = async (userId: number, targetRole: UserRole) => {
  return request<{ message?: string }>({
    url: '/api/admin/users',
    method: 'put',
    data: {
      userId,
      targetRole,
    },
  })
}

export const deleteAdminUser = async (id: number) => {
  return request<{ message?: string }>({
    url: `/api/admin/users/${id}`,
    method: 'delete',
  })
}

export const getAdminPosts = async (): Promise<AdminPost[]> => {
  const response = await request<AdminPost[]>({
    url: '/api/posts/admin/pending',
    method: 'get',
    params: { page: 1, pageSize: 50, status: 0 },
  })
  return Array.isArray(response) ? response : []
}

export const updateAdminPost = async (id: number, payload: Record<string, unknown>) => {
  return request<{ message?: string }>({
    url: `/api/posts/admin/audit/${id}`,
    method: 'post',
    data: payload,
  })
}

export const getAdminCourses = async (): Promise<AdminCourse[]> => {
  const response = await request<AdminCourse[]>({
    url: '/api/admin/courses',
    method: 'get',
  })
  return Array.isArray(response) ? response : []
}

export type AdminCoursePayload = {
  title: string
  description: string
  content?: string
  videoUrl?: string
  coverImage?: string
  category: string
}

export const createAdminCourse = async (payload: AdminCoursePayload) => {
  return request<AdminCourse>({
    url: '/api/admin/courses',
    method: 'post',
    data: payload,
  })
}

export const updateAdminCourse = async (id: number, payload: Record<string, unknown>) => {
  return request<AdminCourse>({
    url: `/api/admin/courses/${id}`,
    method: 'put',
    data: payload,
  })
}

export const deleteAdminCourse = async (id: number) => {
  return request<{ message?: string }>({
    url: `/api/admin/courses/${id}`,
    method: 'delete',
  })
}

export const getAdminMusic = async (): Promise<AdminMusic[]> => {
  const response = await request<{ success?: boolean; data?: AdminMusic[] }>({
    url: '/api/music',
    method: 'get',
  })
  return Array.isArray(response?.data) ? response.data : []
}

export const updateAdminMusic = async (id: number, payload: Record<string, unknown>) => {
  return request<{ message?: string }>({
    url: `/api/music/${id}`,
    method: 'put',
    data: payload,
  })
}

export const getAdminAuditLogs = async (): Promise<AdminAuditLog[]> => {
  const response = await request<{ list?: AdminAuditLog[] }>({
    url: '/api/audit/operation-logs',
    method: 'get',
    params: { page: 1, pageSize: 50 },
  })
  return Array.isArray(response?.list) ? response.list : []
}

export const getAdminMoods = async (
  params: AdminMoodListParams
): Promise<AdminMoodListResponse> => {
  const searchParams = new URLSearchParams()

  if (params.page !== undefined) {
    searchParams.append('page', String(params.page))
  }
  if (params.pageSize !== undefined) {
    searchParams.append('pageSize', String(params.pageSize))
  }
  if (params.userId !== undefined) {
    searchParams.append('userId', String(params.userId))
  }
  if (params.username) {
    searchParams.append('username', params.username)
  }
  if (params.startDate) {
    searchParams.append('startDate', params.startDate)
  }
  if (params.endDate) {
    searchParams.append('endDate', params.endDate)
  }
  if (params.moodType) {
    searchParams.append('moodType', params.moodType)
  }
  if (Array.isArray(params.emotions)) {
    params.emotions.forEach((item) => {
      if (item) {
        searchParams.append('emotions[]', item)
      }
    })
  }

  const query = searchParams.toString()
  const response = await request<AdminMoodListResponse>({
    url: query ? `/api/admin/moods?${query}` : '/api/admin/moods',
    method: 'get',
  })

  return {
    list: Array.isArray(response?.list) ? response.list : [],
    total: Number(response?.total || 0),
    page: Number(response?.page || params.page || 1),
    pageSize: Number(response?.pageSize || params.pageSize || 20),
  }
}
