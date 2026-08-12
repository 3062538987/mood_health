import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface AutomaticRiskCaseDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

type UserRow = RowDataPacket & { user_id: number }

export const createAutomaticRiskCaseRepository = (
  db: AutomaticRiskCaseDatabase = getMysqlPool()
) => {
  const recordTreeholeRisk = async (userId: number): Promise<void> => {
    await db.query<ResultSetHeader>(
      `INSERT INTO risk_signal_events (user_id, signal_type, detected_at)
       VALUES (?, 'treehole_high_risk', ?)`,
      [userId, new Date()]
    )
  }

  const syncCandidates = async (): Promise<number> => {
    const [lowMoodRows] = await db.query<UserRow[]>(
      `SELECT daily.user_id
       FROM (
         SELECT m.user_id, DATE(m.recorded_at) AS record_date, AVG(me.intensity) AS daily_average
         FROM moods m
         INNER JOIN mood_emotions me ON me.mood_id = m.id AND me.is_primary = 1
         WHERE DATE(m.recorded_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()
         GROUP BY m.user_id, DATE(m.recorded_at)
       ) AS daily
       WHERE daily.daily_average < 5
       GROUP BY daily.user_id
       HAVING COUNT(*) = 7`
    )
    const [treeholeRows] = await db.query<UserRow[]>(
      `SELECT DISTINCT user_id
       FROM risk_signal_events
       WHERE signal_type = 'treehole_high_risk'
         AND detected_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)`
    )
    const [aiRows] = await db.query<UserRow[]>(
      `SELECT DISTINCT user_id
       FROM counseling_sessions
       WHERE role = 'user' AND risk_level = 'high'
         AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)`
    )

    const reasonsByUser = new Map<number, string[]>()
    const addReason = (rows: UserRow[], reason: string) => {
      for (const row of rows) {
        const userId = Number(row.user_id)
        reasonsByUser.set(userId, [...(reasonsByUser.get(userId) ?? []), reason])
      }
    }
    addReason(lowMoodRows, '连续7天情绪记录评分低于5分')
    addReason(treeholeRows, '树洞出现高风险内容')
    addReason(aiRows, 'AI问答出现高风险内容')

    const now = new Date()
    for (const [userId, reasons] of reasonsByUser) {
      const summary = `自动风险规则命中：${reasons.join('；')}`
      await db.query<ResultSetHeader>(
        `INSERT INTO cases
           (student_user_id, assigned_counselor_id, source_session_id, origin, status,
            risk_level, summary, trigger_reasons_json, created_at, updated_at)
         VALUES (?, NULL, NULL, 'automatic_risk', 'open', 'high', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           risk_level = 'high', summary = VALUES(summary),
           trigger_reasons_json = VALUES(trigger_reasons_json), updated_at = VALUES(updated_at)`,
        [userId, summary, JSON.stringify(reasons), now, now]
      )
    }

    return reasonsByUser.size
  }

  return { recordTreeholeRisk, syncCandidates }
}

export type AutomaticRiskCaseRepository = ReturnType<typeof createAutomaticRiskCaseRepository>
