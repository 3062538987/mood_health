import request from '@/utils/request'

export interface NotificationPreferences {
  reminderTime: string
  weeklyReportEnabled: boolean
  gameSoundEnabled: boolean
  emotionReminderEnabled: boolean
  weeklyReportNotificationEnabled: boolean
  groupActivityEnabled: boolean
  treeholeReplyEnabled: boolean
  featureUpdateEnabled: boolean
}

export interface UserNotification {
  id: number
  notificationType: 'emotion_reminder' | 'weekly_report' | 'test'
  title: string
  message: string
  actionPath: string | null
  scheduledFor: string
  readAt: string | null
  createdAt: string
}

export const getNotificationPreferences = () =>
  request<NotificationPreferences>({ url: '/api/notifications/preferences', method: 'get' })

export const saveNotificationPreferences = (data: NotificationPreferences) =>
  request<NotificationPreferences>({ url: '/api/notifications/preferences', method: 'put', data })

export const listNotifications = (signal?: AbortSignal) =>
  request<UserNotification[]>({ url: '/api/notifications', method: 'get', signal })

export const processDueNotifications = () =>
  request<UserNotification[]>({ url: '/api/notifications/process-due', method: 'post' })

export const createTestNotification = () =>
  request<UserNotification>({ url: '/api/notifications/test', method: 'post' })

export const markNotificationRead = (id: number) =>
  request<{ read: true }>({ url: `/api/notifications/${id}/read`, method: 'patch' })
