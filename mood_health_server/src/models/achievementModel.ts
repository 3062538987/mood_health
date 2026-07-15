import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  type: string
  threshold: number
  icon: string
  level: 'bronze' | 'silver' | 'gold'
}

export interface UserAchievementEntity {
  id: string
  userId: string
  achievementId: string
  unlockedAt: string
  achievement: AchievementDefinition
}

export interface AchievementProgressEntity {
  achievementId: string
  current: number
  target: number
  isUnlocked: boolean
}

const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-mood',
    name: '初次记录',
    description: '完成 1 次心情记录。',
    type: 'mood_records',
    threshold: 1,
    icon: '📝',
    level: 'bronze',
  },
  {
    id: 'relax-starter',
    name: '放松起步',
    description: '完成 1 次放松活动。',
    type: 'relax_sessions',
    threshold: 1,
    icon: '🌿',
    level: 'bronze',
  },
  {
    id: 'treehole-voice',
    name: '勇敢表达',
    description: '发布 1 篇树洞帖子。',
    type: 'posts',
    threshold: 1,
    icon: '💬',
    level: 'silver',
  },
  {
    id: 'relax-keeper',
    name: '稳定练习',
    description: '累计完成 5 次放松活动。',
    type: 'relax_sessions',
    threshold: 5,
    icon: '🎵',
    level: 'gold',
  },
]

let achievementSchemaChecked = false

const ensureAchievementSchema = () => {
  if (achievementSchemaChecked) return
  sqliteRun(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)
  achievementSchemaChecked = true
}

const tableExists = (name: string): boolean =>
  Boolean(sqliteGet("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?", [name]))

const getMetricValue = async (userId: number, type: string): Promise<number> => {
  const table =
    type === 'mood_records' ? 'moods' : type === 'relax_sessions' ? 'relax_records' : 'posts'
  if (!tableExists(table)) return 0
  const row = sqliteGet(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`, [userId]) as
    | { total: number }
    | undefined
  return Number(row?.total || 0)
}

export const getAllAchievements = async (): Promise<AchievementDefinition[]> => ACHIEVEMENTS

export const getUserAchievements = async (userId: number): Promise<UserAchievementEntity[]> => {
  ensureAchievementSchema()
  const rows = sqliteAll(
    `
      SELECT id, user_id AS userId, achievement_id AS achievementId, unlocked_at AS unlockedAt
      FROM user_achievements
      WHERE user_id = ?
      ORDER BY datetime(unlocked_at) DESC
    `,
    [userId]
  ) as Array<Record<string, unknown>>

  return rows.flatMap((row) => {
    const achievement = ACHIEVEMENTS.find((item) => item.id === String(row.achievementId))
    return achievement
      ? [
          {
            id: String(row.id),
            userId: String(row.userId),
            achievementId: String(row.achievementId),
            unlockedAt: new Date(String(row.unlockedAt)).toISOString(),
            achievement,
          },
        ]
      : []
  })
}

export const getAchievementProgress = async (
  userId: number
): Promise<AchievementProgressEntity[]> => {
  const unlockedIds = new Set((await getUserAchievements(userId)).map((item) => item.achievementId))
  return Promise.all(
    ACHIEVEMENTS.map(async (achievement) => ({
      achievementId: achievement.id,
      current: await getMetricValue(userId, achievement.type),
      target: achievement.threshold,
      isUnlocked: unlockedIds.has(achievement.id),
    }))
  )
}

export const checkAchievements = async (userId: number): Promise<UserAchievementEntity[]> => {
  ensureAchievementSchema()
  const currentUnlocked = new Set(
    (await getUserAchievements(userId)).map((item) => item.achievementId)
  )
  for (const item of await getAchievementProgress(userId)) {
    if (item.current >= item.target && !currentUnlocked.has(item.achievementId)) {
      sqliteRun(
        'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, item.achievementId]
      )
    }
  }
  return (await getUserAchievements(userId)).filter(
    (item) => !currentUnlocked.has(item.achievementId)
  )
}
