import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { SeedDatabase } from './coreSeed'

type Environment = Record<string, string | undefined>

interface IdRow {
  id: number
}

interface EmotionTypeRow extends IdRow {
  code: string
}

export interface SupportAdminMoodDay {
  recordedAt: Date
  emotionCode: 'calm' | 'happy' | 'anxious' | 'tired'
  intensity: number
  note: string
  trigger: string
}

const toMysqlDateTime = (date: Date): string => date.toISOString().slice(0, 23).replace('T', ' ')

const encryptText = (text: string, encryptionKey: string): string => {
  const key = Buffer.from(encryptionKey, 'hex')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be a 32-byte hex string')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex')
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  })
}

export const buildSupportAdminMoodDays = (now: Date): SupportAdminMoodDay[] => {
  const triggers = ['学习安排', '睡眠状态', '同伴关系', '运动放松', '家庭联系', '实习准备']
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((value) => value.type === type)?.value ?? ''
  const anchor = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00.000Z`)
  return Array.from({ length: 365 }, (_, daysAgo) => {
    const recordedAt = new Date(anchor)
    recordedAt.setUTCDate(recordedAt.getUTCDate() - daysAgo)
    recordedAt.setUTCHours(12, 0, 0, 0)

    const inLowPeriod = daysAgo >= 42 && daysAgo <= 48
    const wave = Math.sin(daysAgo / 17) + Math.cos(daysAgo / 31)
    const intensity = inLowPeriod ? 3 + (daysAgo % 2) : Math.max(5, Math.min(9, Math.round(6.5 + wave)))
    const emotionCode: SupportAdminMoodDay['emotionCode'] = inLowPeriod
      ? 'anxious'
      : intensity >= 8
        ? 'happy'
        : daysAgo % 5 === 0
          ? 'tired'
          : 'calm'
    const trigger = triggers[daysAgo % triggers.length]
    return {
      recordedAt,
      emotionCode,
      intensity,
      trigger,
      note: `演示原始记录：${trigger}后的日常情绪自评，分值 ${intensity}/10。`,
    }
  })
}

const requireEnvironment = (env: Environment) => {
  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('ALLOW_DEMO_SEED=true is required before running support admin seed')
  }
  const password = env.DEMO_PASSWORD?.trim()
  const encryptionKey = env.ENCRYPTION_KEY?.trim()
  if (!password) throw new Error('DEMO_PASSWORD is required before running support admin seed')
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required before running support admin seed')
  return { password, encryptionKey }
}

export const seedSupportAdminYearData = async (
  db: SeedDatabase,
  env: Environment = process.env,
  now: Date = new Date()
): Promise<{ userId: number; daysCovered: number; moodCount: number }> => {
  const { password, encryptionKey } = requireEnvironment(env)
  const [role] = await db.query<IdRow>("SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1")
  if (!role) throw new Error('Reference role is missing before support admin seed: super_admin')

  const currentTime = toMysqlDateTime(now)
  const passwordHash = await bcrypt.hash(password, 12)
  await db.query(
    `INSERT INTO users (role_id, username, password_hash, email, nickname, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), password_hash = VALUES(password_hash),
       email = VALUES(email), nickname = VALUES(nickname), status = 'active', updated_at = VALUES(updated_at)`,
    [
      role.id,
      'demo_support_admin',
      passwordHash,
      'demo.support.admin@example.invalid',
      '演示支持管理员',
      currentTime,
      currentTime,
    ]
  )

  const [user] = await db.query<IdRow>('SELECT id FROM users WHERE username = ? LIMIT 1', [
    'demo_support_admin',
  ])
  if (!user) throw new Error('demo_support_admin account was not created')

  const emotionRows = await db.query<EmotionTypeRow>(
    'SELECT id, code FROM emotion_types WHERE code IN (?, ?, ?, ?) AND is_active = 1',
    ['calm', 'happy', 'anxious', 'tired']
  )
  const emotionTypes = new Map(emotionRows.map((row) => [row.code, row.id]))
  const days = buildSupportAdminMoodDays(now)

  // 该账号仅用于固定演示数据。每次重建原始记录，确保时区或算法升级后仍保持恰好 365 天。
  await db.query('DELETE FROM moods WHERE user_id = ?', [user.id])

  for (const day of days) {
    const recordedAt = toMysqlDateTime(day.recordedAt)
    let [mood] = await db.query<IdRow>(
      'SELECT id FROM moods WHERE user_id = ? AND recorded_at = ? LIMIT 1',
      [user.id, recordedAt]
    )
    if (!mood) {
      await db.query(
        `INSERT INTO moods
           (user_id, note_ciphertext, trigger_ciphertext, include_note, recorded_at, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
        [
          user.id,
          encryptText(day.note, encryptionKey),
          encryptText(day.trigger, encryptionKey),
          recordedAt,
          currentTime,
          currentTime,
        ]
      )
      ;[mood] = await db.query<IdRow>('SELECT LAST_INSERT_ID() AS id')
    }
    if (!mood) throw new Error(`Failed to create demo mood for ${recordedAt}`)

    const emotionTypeId = emotionTypes.get(day.emotionCode)
    if (!emotionTypeId) throw new Error(`Reference emotion type is missing: ${day.emotionCode}`)
    await db.query(
      `INSERT IGNORE INTO mood_emotions (mood_id, emotion_type_id, intensity, is_primary)
       VALUES (?, ?, ?, 1)`,
      [mood.id, emotionTypeId, day.intensity]
    )
  }

  return { userId: user.id, daysCovered: days.length, moodCount: days.length }
}
