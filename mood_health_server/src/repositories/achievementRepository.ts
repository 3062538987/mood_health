import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface AchievementDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface AchievementDefinitionDto {
  id: string
  name: string
  description: string
  type: string
  threshold: number
  icon: string
  level: 'bronze' | 'silver' | 'gold'
}

export interface UserAchievementDto {
  id: number
  userId: number
  achievementId: string
  unlockedAt: string
  achievement: AchievementDefinitionDto
}

export interface AchievementProgressDto {
  achievementId: string
  current: number
  target: number
  isUnlocked: boolean
}

type AchievementDefRow = RowDataPacket & {
  id: string
  name: string
  description: string
  type: string
  threshold: number
  icon: string
  level: string
  sort_order: number
}

type UserAchievementRow = RowDataPacket & {
  id: number
  user_id: number
  achievement_id: string
  unlocked_at: Date | string
  name: string
  description: string
  type: string
  threshold: number
  icon: string
  level: string
}

const getMetricTable = (type: string): string | null => {
  switch (type) {
    case 'mood_records': return 'moods'
    case 'relax_sessions': return 'relax_records'
    case 'posts': return 'posts'
    default: return null
  }
}

export const createAchievementRepository = (db: AchievementDatabase = getMysqlPool()) => {
  const getAllDefinitions = async (): Promise<AchievementDefinitionDto[]> => {
    const [rows] = await db.query<AchievementDefRow[]>(
      'SELECT * FROM achievement_definitions ORDER BY sort_order ASC'
    )
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      threshold: row.threshold,
      icon: row.icon,
      level: row.level as 'bronze' | 'silver' | 'gold',
    }))
  }

  const getUserAchievements = async (userId: number): Promise<UserAchievementDto[]> => {
    const [rows] = await db.query<UserAchievementRow[]>(
      `SELECT ua.id, ua.user_id, ua.achievement_id, ua.unlocked_at,
              ad.name, ad.description, ad.type, ad.threshold, ad.icon, ad.level
       FROM user_achievements ua
       JOIN achievement_definitions ad ON ua.achievement_id = ad.id
       WHERE ua.user_id = ?
       ORDER BY ua.unlocked_at DESC`,
      [userId]
    )
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      achievementId: row.achievement_id,
      unlockedAt: row.unlocked_at instanceof Date ? row.unlocked_at.toISOString() : String(row.unlocked_at),
      achievement: {
        id: row.achievement_id,
        name: row.name,
        description: row.description,
        type: row.type,
        threshold: row.threshold,
        icon: row.icon,
        level: row.level as 'bronze' | 'silver' | 'gold',
      },
    }))
  }

  const getMetricValue = async (userId: number, type: string): Promise<number> => {
    const table = getMetricTable(type)
    if (!table) return 0
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM \`${table}\` WHERE user_id = ?`,
        [userId]
      )
      return Number(rows[0]?.total || 0)
    } catch {
      return 0
    }
  }

  const getAchievementProgress = async (userId: number): Promise<AchievementProgressDto[]> => {
    const definitions = await getAllDefinitions()
    const unlocked = await getUserAchievements(userId)
    const unlockedIds = new Set(unlocked.map((item) => item.achievementId))

    const results: AchievementProgressDto[] = []
    for (const achievement of definitions) {
      const current = await getMetricValue(userId, achievement.type)
      results.push({
        achievementId: achievement.id,
        current,
        target: achievement.threshold,
        isUnlocked: unlockedIds.has(achievement.id),
      })
    }
    return results
  }

  const checkAndUnlock = async (userId: number): Promise<UserAchievementDto[]> => {
    const currentUnlocked = await getUserAchievements(userId)
    const unlockedIds = new Set(currentUnlocked.map((item) => item.achievementId))
    const progress = await getAchievementProgress(userId)
    const newlyUnlocked: UserAchievementDto[] = []

    for (const item of progress) {
      if (item.current >= item.target && !unlockedIds.has(item.achievementId)) {
        await db.query<ResultSetHeader>(
          'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
          [userId, item.achievementId]
        )
      }
    }

    const afterUnlock = await getUserAchievements(userId)
    return afterUnlock.filter((item) => !unlockedIds.has(item.achievementId))
  }

  return { getAllDefinitions, getUserAchievements, getAchievementProgress, checkAndUnlock }
}

export type AchievementRepository = ReturnType<typeof createAchievementRepository>