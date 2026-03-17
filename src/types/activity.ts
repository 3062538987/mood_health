/**
 * 活动状态类型
 */
export type ActivityStatus = 'ongoing' | 'upcoming' | 'ended' | 'full'

/**
 * 活动状态配置
 */
export interface ActivityStatusConfig {
  label: string
  type: 'success' | 'info' | 'warning' | 'danger'
  color: string
}

/**
 * 活动接口 - 统一类型定义
 * @interface Activity
 */
export interface Activity {
  id: number
  title: string
  description: string
  startTime: string // ISO 格式
  endTime: string
  maxParticipants: number
  currentParticipants: number
  location: string
  imageUrl?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 活动详情接口
 * @interface ActivityDetail
 * @extends Activity
 */
export interface ActivityDetail extends Activity {
  createdAt: string
  updatedAt: string
}

/**
 * 已报名活动接口
 * @interface JoinedActivity
 * @extends Activity
 * @property {string} joinedAt - 报名时间
 */
export interface JoinedActivity extends Activity {
  joinedAt: string
}

/**
 * 创建活动数据接口
 * @interface CreateActivityData
 */
export interface CreateActivityData {
  title: string
  description: string
  startTime: string
  endTime: string
  maxParticipants: number
  location: string
  imageUrl?: string
}

/**
 * 活动筛选参数接口
 * @interface ActivityFilter
 */
export interface ActivityFilter {
  title?: string
  location?: string
  startDate?: string
  endDate?: string
  status?: string[]
}

/**
 * 分页信息接口
 * @interface PaginationInfo
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * 活动列表响应接口
 * @interface ActivityListResponse
 */
export interface ActivityListResponse {
  data: Activity[]
  pagination: PaginationInfo
}

/**
 * 后端返回的活动数据格式（蛇形命名）
 * 用于 API 响应数据转换
 * @interface ActivityResponse
 */
export interface ActivityResponse {
  id: number
  title: string
  description: string
  start_time: string
  end_time: string
  max_participants: number
  current_participants: number
  location: string
  image_url?: string
  created_at?: string
  updated_at?: string
}
