import request from '@/utils/request'
import type {
  Activity,
  CreateActivityData,
  ActivityResponse,
  ActivityFilter,
  ActivityListResponse,
} from '@/types/activity'

const noBlockingLoadingConfig = {
  showLoading: false,
}

/**
 * 将后端蛇形命名转换为前端驼峰命名
 */
const convertToCamelCase = (data: ActivityResponse): Activity => {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    startTime: data.start_time,
    endTime: data.end_time,
    maxParticipants: data.max_participants,
    currentParticipants: data.current_participants,
    location: data.location,
    imageUrl: data.image_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * 将前端驼峰命名转换为后端蛇形命名
 */
const convertToSnakeCase = (data: CreateActivityData): Record<string, unknown> => {
  return {
    title: data.title,
    description: data.description,
    startTime: data.startTime,
    endTime: data.endTime,
    maxParticipants: data.maxParticipants,
    location: data.location,
    imageUrl: data.imageUrl,
  }
}

/**
 * 获取活动列表（支持筛选）
 */
export const getActivities = async (
  page = 1,
  limit = 10,
  filter: ActivityFilter = {}
): Promise<ActivityListResponse> => {
  const params: Record<string, unknown> = { page, limit }

  if (filter.title) params.title = filter.title
  if (filter.location) params.location = filter.location
  if (filter.startDate) params.startDate = filter.startDate
  if (filter.endDate) params.endDate = filter.endDate
  if (filter.status && filter.status.length > 0) {
    params.status = filter.status.join(',')
  }

  const response = await request<
    | ActivityResponse[]
    | {
        list?: ActivityResponse[]
        data?: ActivityResponse[]
        pagination?: {
          page: number
          limit: number
          total: number
          totalPages: number
        }
      }
  >({
    url: `/api/activities/list`,
    method: 'get',
    params,
    ...noBlockingLoadingConfig,
  })

  // request 拦截器会返回 res.data，活动列表接口现统一为 { list, pagination }
  // 这里同时兼容旧结构，避免历史缓存或旧返回导致页面报错。
  const list = Array.isArray(response) ? response : (response.list ?? response.data ?? [])
  const pagination = Array.isArray(response)
    ? {
        page,
        limit,
        total: list.length,
        totalPages: Math.max(1, Math.ceil(list.length / Math.max(limit, 1))),
      }
    : (response.pagination ?? {
        page,
        limit,
        total: list.length,
        totalPages: Math.max(1, Math.ceil(list.length / Math.max(limit, 1))),
      })

  return {
    data: list.map(convertToCamelCase),
    pagination,
  }
}

/**
 * 获取活动详情
 */
export const getActivityDetail = async (id: number): Promise<Activity> => {
  const data = await request<ActivityResponse>({
    url: `/api/activities/detail/${id}`,
    method: 'get',
    ...noBlockingLoadingConfig,
  })
  return convertToCamelCase(data)
}

/**
 * 报名活动
 */
export const joinActivity = async (id: number): Promise<void> => {
  await request({
    url: `/api/activities/join/${id}`,
    method: 'post',
    ...noBlockingLoadingConfig,
  })
}

/**
 * 取消报名活动
 */
export const cancelJoinActivity = async (id: number): Promise<void> => {
  await request({
    url: `/api/activities/cancel/${id}`,
    method: 'post',
    ...noBlockingLoadingConfig,
  })
}

/**
 * 获取我已报名的活动
 */
export const getMyJoinedActivities = async (): Promise<Activity[]> => {
  const data = await request<ActivityResponse[]>({
    url: '/api/activities/my-joined',
    method: 'get',
    ...noBlockingLoadingConfig,
  })
  return data.map(convertToCamelCase)
}

/**
 * 创建活动（管理员）
 */
export const createActivity = async (data: CreateActivityData): Promise<void> => {
  await request({
    url: '/api/activities/create',
    method: 'post',
    data: convertToSnakeCase(data),
    ...noBlockingLoadingConfig,
  })
}

/**
 * 更新活动（管理员）
 */
export const updateActivity = async (
  id: number,
  data: Partial<CreateActivityData>
): Promise<void> => {
  const snakeCaseData: Record<string, unknown> = {}
  if (data.title !== undefined) snakeCaseData.title = data.title
  if (data.description !== undefined) snakeCaseData.description = data.description
  if (data.startTime !== undefined) snakeCaseData.startTime = data.startTime
  if (data.endTime !== undefined) snakeCaseData.endTime = data.endTime
  if (data.maxParticipants !== undefined) snakeCaseData.maxParticipants = data.maxParticipants
  if (data.location !== undefined) snakeCaseData.location = data.location
  if (data.imageUrl !== undefined) snakeCaseData.imageUrl = data.imageUrl

  await request({
    url: `/api/activities/update/${id}`,
    method: 'put',
    data: snakeCaseData,
    ...noBlockingLoadingConfig,
  })
}

/**
 * 删除活动（管理员）
 */
export const deleteActivity = async (id: number): Promise<void> => {
  await request({
    url: `/api/activities/delete/${id}`,
    method: 'delete',
    ...noBlockingLoadingConfig,
  })
}

/**
 * 参与者信息
 */
export interface Participant {
  id: number
  username: string
  nickname: string
  avatar: string
  joined_at: string
}

/**
 * 活动详情（包含参与者列表）
 */
export interface ActivityDetailWithParticipants {
  activity: Activity
  participants: Participant[]
}

/**
 * 获取活动详情（包含参与者列表）
 */
export const getActivityDetailWithParticipants = async (
  id: number
): Promise<ActivityDetailWithParticipants> => {
  const response = await request<{
    activity: ActivityResponse
    participants: Participant[]
  }>({
    url: `/api/activities/detail-with-participants/${id}`,
    method: 'get',
    ...noBlockingLoadingConfig,
  })

  return {
    activity: convertToCamelCase(response.activity),
    participants: response.participants,
  }
}
