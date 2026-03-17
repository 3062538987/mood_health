import request from '@/utils/request'

export const getActivityList = () => {
  return request({
    url: '/api/activities/list',
    method: 'get',
  })
}

export const joinActivity = (activityId: number) => {
  return request({
    url: `/api/activities/join/${activityId}`,
    method: 'post',
  })
}

export const getActivityDetail = (activityId: number) => {
  return request({
    url: `/api/activities/detail/${activityId}`,
    method: 'get',
  })
}

export const getMyJoinedActivities = () => {
  return request({
    url: '/api/activities/my-joined',
    method: 'get',
  })
}
