/**
 * 用户画像服务
 * 聚合用户情绪数据生成 AI 可用的用户画像，并注入到 AI 对话中
 */

import { getMysqlPool } from '../config/mysql'
import { RowDataPacket } from 'mysql2'

export interface UserProfile {
  moodBaseline: string        // 情绪基线：如"中等偏积极"
  moodTrend: string           // 情绪趋势：如"上升"
  recentAssessment: string    // 最近测评：如"GAD-7: 8分(轻度焦虑)"
  keyEvents: string[]         // 关键事件
  preferredStyle: string      // 偏好风格：如"温暖鼓励型"
  dominantMood: string        // 主导情绪：如"平静"
  moodCount: number           // 近30天情绪记录数
  updatedAt: string
}

export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  try {
    const pool = getMysqlPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT profile_data FROM user_ai_profiles WHERE user_id = ?',
      [userId]
    )
    if (rows && rows.length > 0) {
      return typeof rows[0].profile_data === 'string'
        ? JSON.parse(rows[0].profile_data)
        : rows[0].profile_data
    }
    return null
  } catch (error) {
    console.error('获取用户画像失败:', error)
    return null
  }
}

export async function updateUserProfile(userId: number): Promise<UserProfile | null> {
  try {
    const pool = getMysqlPool()

    // 1. 情绪基线：近30天平均情绪强度
    const [moodRows] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(me.intensity) as avg_score, COUNT(DISTINCT m.id) as cnt
       FROM moods m
       JOIN mood_emotions me ON me.mood_id = m.id
       WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    )
    const avgScore = Number(moodRows?.[0]?.avg_score) || 0
    const moodCount = Number(moodRows?.[0]?.cnt) || 0

    // 2. 主导情绪：近30天出现最多的情绪
    const [domRows] = await pool.query<RowDataPacket[]>(
      `SELECT et.name as mood_type, COUNT(*) as cnt
       FROM moods m
       JOIN mood_emotions me ON me.mood_id = m.id
       JOIN emotion_types et ON et.id = me.emotion_type_id
       WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY et.name ORDER BY cnt DESC LIMIT 1`,
      [userId]
    )
    const dominantMood = domRows?.[0]?.mood_type || '未知'

    // 3. 情绪趋势：比较近15天和15-30天
    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(me.intensity) as avg_score FROM moods m
       JOIN mood_emotions me ON me.mood_id = m.id
       WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)`,
      [userId]
    )
    const [olderRows] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(me.intensity) as avg_score FROM moods m
       JOIN mood_emotions me ON me.mood_id = m.id
       WHERE m.user_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND m.created_at < DATE_SUB(NOW(), INTERVAL 15 DAY)`,
      [userId]
    )
    const recentAvg = Number(recentRows?.[0]?.avg_score) || 0
    const olderAvg = Number(olderRows?.[0]?.avg_score) || 0
    let moodTrend = '平稳'
    if (recentAvg > olderAvg + 0.5) moodTrend = '上升'
    else if (recentAvg < olderAvg - 0.5) moodTrend = '下降'

    // 4. 情绪基线描述
    let moodBaseline = '未知'
    if (avgScore >= 4) moodBaseline = '积极'
    else if (avgScore >= 3) moodBaseline = '中等偏积极'
    else if (avgScore >= 2) moodBaseline = '中等偏消极'
    else if (avgScore > 0) moodBaseline = '消极'

    // 5. 最近测评
    let recentAssessment = '暂无'
    try {
      const [assessRows] = await pool.query<RowDataPacket[]>(
        `SELECT ai.name as scale_type, ass.raw_score as total_score, ass.screening_level as result_text
         FROM assessment_sessions ass
         JOIN assessment_versions av ON av.id = ass.assessment_version_id
         JOIN assessment_instruments ai ON ai.id = av.instrument_id
         WHERE ass.user_id = ? AND ass.status = 'submitted'
         ORDER BY ass.created_at DESC LIMIT 1`,
        [userId]
      )
      if (assessRows?.[0]) {
        const score = assessRows[0].total_score != null ? `${assessRows[0].total_score}分` : ''
        const level = assessRows[0].result_text ? `(${assessRows[0].result_text})` : ''
        recentAssessment = `${assessRows[0].scale_type}: ${score}${level}`
      }
    } catch { /* 表可能不存在 */ }

    const profile: UserProfile = {
      moodBaseline,
      moodTrend,
      recentAssessment,
      keyEvents: [],
      preferredStyle: '温暖鼓励型',
      dominantMood,
      moodCount,
      updatedAt: new Date().toISOString(),
    }

    // 保存
    const profileJson = JSON.stringify(profile)
    await pool.query(
      `INSERT INTO user_ai_profiles (user_id, profile_data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE profile_data = VALUES(profile_data)`,
      [userId, profileJson]
    )

    return profile
  } catch (error) {
    console.error('更新用户画像失败:', error)
    return null
  }
}

/**
 * 将画像转换为可注入 system prompt 的文本
 */
export function profileToPromptText(profile: UserProfile): string {
  if (!profile || profile.moodCount === 0) return ''

  let text = `[用户画像] 情绪基线：${profile.moodBaseline}，近期趋势：${profile.moodTrend}，主导情绪：${profile.dominantMood}`
  if (profile.recentAssessment !== '暂无') {
    text += `，最近测评：${profile.recentAssessment}`
  }
  text += `，偏好风格：${profile.preferredStyle}`
  return text
}