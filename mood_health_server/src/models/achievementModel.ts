import sql from 'mssql'
import pool, { isSqliteClient } from '../config/database'
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

const ensureAchievementSchema = async () => {
  if (achievementSchemaChecked) {
    return
  }

  if (isSqliteClient) {
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
    return
  }

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_achievements')
    BEGIN
      CREATE TABLE user_achievements (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        achievement_id NVARCHAR(100) NOT NULL,
        unlocked_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END
  `)

  achievementSchemaChecked = true
}

const getMetricValue = async (userId: number, type: string): Promise<number> => {
  if (isSqliteClient) {
    if (type === 'mood_records') {
      const row = sqliteGet('SELECT COUNT(*) AS total FROM moods WHERE user_id = ?', [userId]) as
        | { total: number }
        | undefined
      return Number(row?.total || 0)
    }

    if (type === 'relax_sessions') {
      const relaxTable = sqliteGet(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'relax_records'"
      ) as { ok: number } | undefined
      if (!relaxTable) {
        return 0
      }
      const row = sqliteGet('SELECT COUNT(*) AS total FROM relax_records WHERE user_id = ?', [
        userId,
      ]) as { total: number } | undefined
      return Number(row?.total || 0)
    }

    if (type === 'posts') {
      const postsTable = sqliteGet(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'posts'"
      ) as { ok: number } | undefined
      if (!postsTable) {
        return 0
      }
      const row = sqliteGet('SELECT COUNT(*) AS total FROM posts WHERE user_id = ?', [userId]) as
        | { total: number }
        | undefined
      return Number(row?.total || 0)
    }

    return 0
  }

  if (type === 'mood_records') {
    const result = await pool.request().input('userId', sql.Int, userId).query(`
      SELECT COUNT(*) AS total FROM moods WHERE user_id = @userId
    `)
    return result.recordset[0]?.total || 0
  }

  if (type === 'relax_sessions') {
    const relaxTable = await pool.request().query(`
      SELECT 1 AS ok FROM sys.tables WHERE name = 'relax_records'
    `)
    if (!relaxTable.recordset.length) {
      return 0
    }
    const result = await pool.request().input('userId', sql.Int, userId).query(`
      SELECT COUNT(*) AS total FROM relax_records WHERE user_id = @userId
    `)
    return result.recordset[0]?.total || 0
  }

  if (type === 'posts') {
    const postsTable = await pool.request().query(`
      SELECT 1 AS ok FROM sys.tables WHERE name = 'posts'
    `)
    if (!postsTable.recordset.length) {
      return 0
    }
    const result = await pool.request().input('userId', sql.Int, userId).query(`
      SELECT COUNT(*) AS total FROM posts WHERE user_id = @userId
    `)
    return result.recordset[0]?.total || 0
  }

  return 0
}

export const getAllAchievements = async (): Promise<AchievementDefinition[]> => ACHIEVEMENTS

export const getUserAchievements = async (userId: number): Promise<UserAchievementEntity[]> => {
  await ensureAchievementSchema()

  if (isSqliteClient) {
    const rows = sqliteAll(
      `
        SELECT id,
               user_id AS userId,
               achievement_id AS achievementId,
               unlocked_at AS unlockedAt
        FROM user_achievements
        WHERE user_id = ?
        ORDER BY datetime(unlocked_at) DESC
      `,
      [userId]
    ) as Array<Record<string, unknown>>

    return rows
      .map((row: Record<string, unknown>) => {
        const achievement = ACHIEVEMENTS.find((item) => item.id === String(row.achievementId))
        if (!achievement) {
          return null
        }
        return {
          id: String(row.id),
          userId: String(row.userId),
          achievementId: String(row.achievementId),
          unlockedAt: new Date(String(row.unlockedAt)).toISOString(),
          achievement,
        } satisfies UserAchievementEntity
      })
      .filter(Boolean) as UserAchievementEntity[]
  }

  const result = await pool.request().input('userId', sql.Int, userId).query(`
    SELECT id, user_id AS userId, achievement_id AS achievementId, unlocked_at AS unlockedAt
    FROM user_achievements
    WHERE user_id = @userId
    ORDER BY unlocked_at DESC
  `)

  return result.recordset
    .map((row: Record<string, unknown>) => {
      const achievement = ACHIEVEMENTS.find((item) => item.id === String(row.achievementId))
      if (!achievement) {
        return null
      }
      return {
        id: String(row.id),
        userId: String(row.userId),
        achievementId: String(row.achievementId),
        unlockedAt: new Date(String(row.unlockedAt)).toISOString(),
        achievement,
      } satisfies UserAchievementEntity
    })
    .filter(Boolean) as UserAchievementEntity[]
}

export const getAchievementProgress = async (
  userId: number
): Promise<AchievementProgressEntity[]> => {
  const unlocked = await getUserAchievements(userId)
  const unlockedIds = new Set(unlocked.map((item) => item.achievementId))

  return Promise.all(
    ACHIEVEMENTS.map(async (achievement) => {
      const current = await getMetricValue(userId, achievement.type)
      return {
        achievementId: achievement.id,
        current,
        target: achievement.threshold,
        isUnlocked: unlockedIds.has(achievement.id),
      }
    })
  )
}

export const checkAchievements = async (userId: number): Promise<UserAchievementEntity[]> => {
  await ensureAchievementSchema()

  const progress = await getAchievementProgress(userId)
  const currentUnlocked = new Set(
    (await getUserAchievements(userId)).map((item) => item.achievementId)
  )

  for (const item of progress) {
    if (item.current >= item.target && !currentUnlocked.has(item.achievementId)) {
      if (isSqliteClient) {
        sqliteRun(
          `
            INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
            VALUES (?, ?)
          `,
          [userId, item.achievementId]
        )
        continue
      }

      await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('achievementId', sql.NVarChar, item.achievementId).query(`
          IF NOT EXISTS (
            SELECT 1 FROM user_achievements
            WHERE user_id = @userId AND achievement_id = @achievementId
          )
          BEGIN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (@userId, @achievementId)
          END
        `)
    }
  }

  const latestUnlocked = await getUserAchievements(userId)
  return latestUnlocked.filter((item) => !currentUnlocked.has(item.achievementId))
}
