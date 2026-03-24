import type { Activity, ActivityFilter, ActivityListResponse } from '@/types/activity'
import {
  getActivities,
  getActivityDetail as getActivityDetailV2,
  getMyJoinedActivities as getMyJoinedActivitiesV2,
  joinActivity as joinActivityV2,
} from '@/api/activityApi'

/**
 * @deprecated 请改用 `@/api/activityApi`。
 * 该文件仅作为历史兼容层，所有实现已转调新封装，避免双份逻辑分叉。
 */
export const getActivityList = async (
  page = 1,
  limit = 10,
  filter: ActivityFilter = {}
): Promise<ActivityListResponse> => {
  return getActivities(page, limit, filter)
}

/** @deprecated 请改用 `@/api/activityApi.joinActivity` */
export const joinActivity = (activityId: number): Promise<void> => {
  return joinActivityV2(activityId)
}

/** @deprecated 请改用 `@/api/activityApi.getActivityDetail` */
export const getActivityDetail = (activityId: number): Promise<Activity> => {
  return getActivityDetailV2(activityId)
}

/** @deprecated 请改用 `@/api/activityApi.getMyJoinedActivities` */
export const getMyJoinedActivities = (): Promise<Activity[]> => {
  return getMyJoinedActivitiesV2()
}
