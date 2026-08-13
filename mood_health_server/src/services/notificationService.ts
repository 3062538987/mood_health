import {
  createNotificationRepository,
  NotificationPreferences,
  NotificationRepository,
  UserNotification,
} from '../repositories/notificationRepository'

export class NotificationServiceError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
    this.name = 'NotificationServiceError'
  }
}

interface NotificationServiceDependencies {
  repository?: NotificationRepository
  now?: () => Date
}

const booleanKeys: Array<keyof Omit<NotificationPreferences, 'reminderTime'>> = [
  'weeklyReportEnabled',
  'gameSoundEnabled',
  'emotionReminderEnabled',
  'weeklyReportNotificationEnabled',
  'groupActivityEnabled',
  'treeholeReplyEnabled',
  'featureUpdateEnabled',
]

const shanghaiParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    weekday: value('weekday'),
  }
}

const requireUserId = (userId: number): number => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new NotificationServiceError(400, '用户参数无效')
  }
  return userId
}

export const createNotificationService = (dependencies: NotificationServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createNotificationRepository()
  const now = dependencies.now ?? (() => new Date())

  const getPreferences = (userId: number) => repository.getPreferences(requireUserId(userId))

  const savePreferences = async (userId: number, value: NotificationPreferences) => {
    if (!/^([01]\d|2[0-3]):00$/.test(value.reminderTime)) {
      throw new NotificationServiceError(400, '提醒时间必须是整点')
    }
    if (booleanKeys.some((key) => typeof value[key] !== 'boolean')) {
      throw new NotificationServiceError(400, '通知开关必须是布尔值')
    }
    return repository.savePreferences(requireUserId(userId), value)
  }

  const processDue = async (userId: number): Promise<UserNotification[]> => {
    const validUserId = requireUserId(userId)
    const preferences = await repository.getPreferences(validUserId)
    const current = now()
    const parts = shanghaiParts(current)
    const created: UserNotification[] = []

    if (
      preferences.emotionReminderEnabled &&
      parts.time >= preferences.reminderTime &&
      !(await repository.hasMoodOnDate(validUserId, parts.date))
    ) {
      created.push(
        await repository.createNotificationIfAbsent({
          userId: validUserId,
          notificationType: 'emotion_reminder',
          title: '记录一下此刻的心情',
          message: '今天还没有情绪记录，用一分钟照顾一下自己的感受吧。',
          actionPath: '/mood/record',
          dedupeKey: `emotion-reminder:${parts.date}`,
          scheduledFor: current,
        })
      )
    }

    if (
      parts.weekday === 'Mon' &&
      parts.time >= '09:00' &&
      preferences.weeklyReportEnabled &&
      preferences.weeklyReportNotificationEnabled
    ) {
      created.push(
        await repository.createNotificationIfAbsent({
          userId: validUserId,
          notificationType: 'weekly_report',
          title: '你的情绪周报已生成',
          message: '周报基于你最近一周的真实情绪记录计算，点击即可查看。',
          actionPath: '/mood/analysis',
          dedupeKey: `weekly-report:${parts.date}`,
          scheduledFor: current,
        })
      )
    }

    return created
  }

  const createTestNotification = (userId: number) => {
    const validUserId = requireUserId(userId)
    const current = now()
    return repository.createNotificationIfAbsent({
      userId: validUserId,
      notificationType: 'test',
      title: '提醒测试成功',
      message: '这是由服务端生成的真实站内提醒。',
      actionPath: '/user/setting',
      dedupeKey: `test:${current.getTime()}`,
      scheduledFor: current,
    })
  }

  const listNotifications = (userId: number) => repository.listNotifications(requireUserId(userId))

  const markRead = async (userId: number, notificationId: number) => {
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      throw new NotificationServiceError(400, '通知参数无效')
    }
    const updated = await repository.markRead(requireUserId(userId), notificationId)
    if (!updated) throw new NotificationServiceError(404, '通知不存在')
    return { read: true }
  }

  return {
    getPreferences,
    savePreferences,
    processDue,
    createTestNotification,
    listNotifications,
    markRead,
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
