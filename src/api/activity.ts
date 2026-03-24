import request from '@/utils/request'
import type {
  Activity,
  ActivityFilter,
  ActivityListResponse,
  ActivityResponse,
  PaginationInfo,
} from '@/types/activity'

const noBlockingLoadingConfig = {
  showLoading: false,
}

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

const defaultPagination = (page: number, limit: number, total: number): PaginationInfo => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / Math.max(limit, 1))),
})

export const getActivityList = async (
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
        pagination?: PaginationInfo
      }
  >({
    url: '/api/activities/list',
    method: 'get',
    params,
    ...noBlockingLoadingConfig,
  })

  const list = Array.isArray(response) ? response : (response.list ?? response.data ?? [])
  const pagination = Array.isArray(response)
    ? defaultPagination(page, limit, list.length)
    : (response.pagination ?? defaultPagination(page, limit, list.length))

  return {
    data: list.map(convertToCamelCase),
    pagination,
  }
}

export const joinActivity = (activityId: number) => {
  return request({
    url: `/api/activities/join/${activityId}`,
    method: 'post',
    ...noBlockingLoadingConfig,
  })
}

export const getActivityDetail = (activityId: number) => {
  return request({
    url: `/api/activities/detail/${activityId}`,
    method: 'get',
    ...noBlockingLoadingConfig,
  })
}

export const getMyJoinedActivities = () => {
  return request({
    url: '/api/activities/my-joined',
    method: 'get',
    ...noBlockingLoadingConfig,
  })
}
