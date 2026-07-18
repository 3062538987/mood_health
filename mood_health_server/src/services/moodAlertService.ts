import { getMysqlPool } from '../config/mysql'
import { ResultSetHeader, RowDataPacket, Pool } from 'mysql2'
import logger from '../utils/logger'

interface MoodAlertRow extends RowDataPacket {
  id: number
  user_id: number
  alert_type: string
  alert_message: string
  trigger_records: string | null
  is_read: number
  created_at: Date
}

interface MoodIntensityRow extends RowDataPacket {
  id: number
  intensity: number
}

interface CountRow extends RowDataPacket {
  cnt: number
}

export interface MoodAlert {
  id: number
  type: string
  message: string
  triggerRecords: number[]
  isRead: boolean
  createdAt: string
}

const ALERT_TYPES = {
  continuous_low: '连续低落',
  high_fluctuation: '明显波动',
}

const checkContinuousLow = async (pool: Pool, userId: number): Promise<{ triggered: boolean; recordIds: number[] }> => {
  const [rows] = await pool.query<MoodIntensityRow[]>(
    `
    SELECT m.id, me.intensity
    FROM moods m
    JOIN mood_emotions me ON me.mood_id = m.id
    WHERE m.user_id = ?
      AND DATE(m.recorded_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
    ORDER BY m.recorded_at DESC
    `,
    [userId]
  )

  if (rows.length < 3) return { triggered: false, recordIds: [] }

  const recentThree = rows.slice(0, 3)
  const allLow = recentThree.every((r) => Number(r.intensity) < 4)

  return {
    triggered: allLow,
    recordIds: allLow ? recentThree.map((r) => Number(r.id)) : [],
  }
}

const checkHighFluctuation = async (pool: Pool, userId: number): Promise<{ triggered: boolean; recordIds: number[] }> => {
  const [rows] = await pool.query<MoodIntensityRow[]>(
    `
    SELECT m.id, me.intensity
    FROM moods m
    JOIN mood_emotions me ON me.mood_id = m.id
    WHERE m.user_id = ?
      AND DATE(m.recorded_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
    ORDER BY m.recorded_at DESC
    `,
    [userId]
  )

  if (rows.length < 3) return { triggered: false, recordIds: [] }

  const recentThree = rows.slice(0, 3)
  const intensities = recentThree.map((r) => Number(r.intensity))
  const maxDiff = Math.max(...intensities) - Math.min(...intensities)

  return {
    triggered: maxDiff > 4,
    recordIds: maxDiff > 4 ? recentThree.map((r) => Number(r.id)) : [],
  }
}

const hasRecentAlert = async (pool: Pool, userId: number, alertType: string): Promise<boolean> => {
  const [rows] = await pool.query<CountRow[]>(
    `
    SELECT COUNT(*) as cnt
    FROM mood_alerts
    WHERE user_id = ? AND alert_type = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `,
    [userId, alertType]
  )
  return Number(rows[0]?.cnt ?? 0) > 0
}

const saveAlert = async (
  pool: Pool,
  userId: number,
  alertType: string,
  message: string,
  recordIds: number[]
): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `
    INSERT INTO mood_alerts (user_id, alert_type, alert_message, trigger_records, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, NOW())
    `,
    [userId, alertType, message, JSON.stringify(recordIds)]
  )
  return Number(result.insertId)
}

export interface MoodAlertServiceDependencies {
  pool?: Pool
}

export const createMoodAlertService = (deps: MoodAlertServiceDependencies = {}) => {
  const pool = deps.pool ?? getMysqlPool()

  const detectAlerts = async (userId: number): Promise<MoodAlert[]> => {
    try {
      const alerts: MoodAlert[] = []

      const [continuousLow, highFluctuation] = await Promise.all([
        checkContinuousLow(pool, userId),
        checkHighFluctuation(pool, userId),
      ])

      if (continuousLow.triggered) {
        const alreadyAlerted = await hasRecentAlert(pool, userId, 'continuous_low')
        if (!alreadyAlerted) {
          const id = await saveAlert(
            pool,
            userId,
            'continuous_low',
            '最近3天情绪持续处于较低水平，建议关注自己的情绪状态，适当安排放松活动或与信任的人交流。',
            continuousLow.recordIds
          )
          alerts.push({
            id,
            type: 'continuous_low',
            message: '最近3天情绪持续处于较低水平，建议关注自己的情绪状态，适当安排放松活动或与信任的人交流。',
            triggerRecords: continuousLow.recordIds,
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        }
      }

      if (highFluctuation.triggered) {
        const alreadyAlerted = await hasRecentAlert(pool, userId, 'high_fluctuation')
        if (!alreadyAlerted) {
          const id = await saveAlert(
            pool,
            userId,
            'high_fluctuation',
            '最近3天情绪波动较大，情绪起伏明显，建议回顾近期事件并尝试稳定情绪节奏。',
            highFluctuation.recordIds
          )
          alerts.push({
            id,
            type: 'high_fluctuation',
            message: '最近3天情绪波动较大，情绪起伏明显，建议回顾近期事件并尝试稳定情绪节奏。',
            triggerRecords: highFluctuation.recordIds,
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        }
      }

      return alerts
    } catch (error) {
      logger.warn('检测提醒失败（可能表未创建）', { error: (error as Error).message })
      return []
    }
  }

  const getAlerts = async (userId: number): Promise<MoodAlert[]> => {
    try {
      const [rows] = await pool.query<MoodAlertRow[]>(
        `
      SELECT id, user_id, alert_type, alert_message, trigger_records, is_read, created_at
      FROM mood_alerts
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
      `,
        [userId]
      )

      return rows.map((row) => ({
        id: Number(row.id),
        type: row.alert_type,
        message: row.alert_message,
        triggerRecords: row.trigger_records ? JSON.parse(row.trigger_records) : [],
        isRead: Number(row.is_read) === 1,
        createdAt: new Date(row.created_at).toISOString(),
      }))
    } catch (error) {
      logger.warn('获取提醒列表失败（可能表未创建）', { error: (error as Error).message })
      return []
    }
  }

  const markAsRead = async (userId: number, alertId: number): Promise<boolean> => {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `
      UPDATE mood_alerts
      SET is_read = 1
      WHERE id = ? AND user_id = ?
      `,
        [alertId, userId]
      )
      return Number(result.affectedRows) > 0
    } catch (error) {
      logger.warn('标记提醒已读失败（可能表未创建）', { error: (error as Error).message })
      return false
    }
  }

  return {
    detectAlerts,
    getAlerts,
    markAsRead,
  }
}

export type MoodAlertService = ReturnType<typeof createMoodAlertService>