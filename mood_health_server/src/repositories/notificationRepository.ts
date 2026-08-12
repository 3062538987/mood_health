import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

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

export type UserNotificationType = 'emotion_reminder' | 'weekly_report' | 'test'

export interface UserNotification {
  id: number
  notificationType: UserNotificationType
  title: string
  message: string
  actionPath: string | null
  scheduledFor: string
  readAt: string | null
  createdAt: string
}

export interface CreateNotificationInput {
  userId: number
  notificationType: UserNotificationType
  title: string
  message: string
  actionPath: string | null
  dedupeKey: string
  scheduledFor: Date
}

export interface NotificationDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

type PreferenceRow = RowDataPacket & {
  reminder_time: string
  weekly_report_enabled: number | boolean
  game_sound_enabled: number | boolean
  emotion_reminder_enabled: number | boolean
  weekly_report_notification_enabled: number | boolean
  group_activity_enabled: number | boolean
  treehole_reply_enabled: number | boolean
  feature_update_enabled: number | boolean
}

type NotificationRow = RowDataPacket & {
  id: number
  notification_type: string
  title: string
  message: string
  action_path: string | null
  scheduled_for: Date | string
  read_at: Date | string | null
  created_at: Date | string
}

const defaults: NotificationPreferences = {
  reminderTime: '20:00',
  weeklyReportEnabled: true,
  gameSoundEnabled: true,
  emotionReminderEnabled: true,
  weeklyReportNotificationEnabled: true,
  groupActivityEnabled: true,
  treeholeReplyEnabled: true,
  featureUpdateEnabled: true,
}

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapPreferences = (row?: PreferenceRow): NotificationPreferences =>
  row
    ? {
        reminderTime: String(row.reminder_time).slice(0, 5),
        weeklyReportEnabled: Boolean(row.weekly_report_enabled),
        gameSoundEnabled: Boolean(row.game_sound_enabled),
        emotionReminderEnabled: Boolean(row.emotion_reminder_enabled),
        weeklyReportNotificationEnabled: Boolean(row.weekly_report_notification_enabled),
        groupActivityEnabled: Boolean(row.group_activity_enabled),
        treeholeReplyEnabled: Boolean(row.treehole_reply_enabled),
        featureUpdateEnabled: Boolean(row.feature_update_enabled),
      }
    : { ...defaults }

const mapNotification = (row: NotificationRow): UserNotification => ({
  id: Number(row.id),
  notificationType: row.notification_type as UserNotificationType,
  title: row.title,
  message: row.message,
  actionPath: row.action_path,
  scheduledFor: toIso(row.scheduled_for),
  readAt: row.read_at === null ? null : toIso(row.read_at),
  createdAt: toIso(row.created_at),
})

export const createNotificationRepository = (db: NotificationDatabase = getMysqlPool()) => {
  const getPreferences = async (userId: number): Promise<NotificationPreferences> => {
    const [rows] = await db.query<PreferenceRow[]>(
      'SELECT * FROM user_notification_preferences WHERE user_id = ? LIMIT 1',
      [userId]
    )
    return mapPreferences(rows[0])
  }

  const savePreferences = async (
    userId: number,
    value: NotificationPreferences
  ): Promise<NotificationPreferences> => {
    await db.query<ResultSetHeader>(
      `INSERT INTO user_notification_preferences
         (user_id, reminder_time, weekly_report_enabled, game_sound_enabled,
          emotion_reminder_enabled, weekly_report_notification_enabled,
          group_activity_enabled, treehole_reply_enabled, feature_update_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reminder_time = VALUES(reminder_time),
         weekly_report_enabled = VALUES(weekly_report_enabled),
         game_sound_enabled = VALUES(game_sound_enabled),
         emotion_reminder_enabled = VALUES(emotion_reminder_enabled),
         weekly_report_notification_enabled = VALUES(weekly_report_notification_enabled),
         group_activity_enabled = VALUES(group_activity_enabled),
         treehole_reply_enabled = VALUES(treehole_reply_enabled),
         feature_update_enabled = VALUES(feature_update_enabled)`,
      [
        userId,
        `${value.reminderTime}:00`,
        value.weeklyReportEnabled,
        value.gameSoundEnabled,
        value.emotionReminderEnabled,
        value.weeklyReportNotificationEnabled,
        value.groupActivityEnabled,
        value.treeholeReplyEnabled,
        value.featureUpdateEnabled,
      ]
    )
    return value
  }

  const hasMoodOnDate = async (userId: number, date: string): Promise<boolean> => {
    const [rows] = await db.query<(RowDataPacket & { total: number | string })[]>(
      'SELECT COUNT(*) AS total FROM moods WHERE user_id = ? AND DATE(recorded_at) = ?',
      [userId, date]
    )
    return Number(rows[0]?.total ?? 0) > 0
  }

  const createNotificationIfAbsent = async (
    input: CreateNotificationInput
  ): Promise<UserNotification> => {
    await db.query<ResultSetHeader>(
      `INSERT IGNORE INTO user_notifications
         (user_id, notification_type, title, message, action_path, dedupe_key, scheduled_for)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.notificationType,
        input.title,
        input.message,
        input.actionPath,
        input.dedupeKey,
        input.scheduledFor,
      ]
    )
    const [rows] = await db.query<NotificationRow[]>(
      'SELECT * FROM user_notifications WHERE user_id = ? AND dedupe_key = ? LIMIT 1',
      [input.userId, input.dedupeKey]
    )
    if (!rows[0]) throw new Error('notification was not created')
    return mapNotification(rows[0])
  }

  const listNotifications = async (userId: number, limit = 30): Promise<UserNotification[]> => {
    const [rows] = await db.query<NotificationRow[]>(
      `SELECT * FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [userId, limit]
    )
    return rows.map(mapNotification)
  }

  const markRead = async (userId: number, notificationId: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE user_notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?',
      [new Date(), notificationId, userId]
    )
    return result.affectedRows > 0
  }

  return {
    getPreferences,
    savePreferences,
    hasMoodOnDate,
    createNotificationIfAbsent,
    listNotifications,
    markRead,
  }
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>
