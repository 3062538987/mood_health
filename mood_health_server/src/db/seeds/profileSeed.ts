import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

import { SeedDatabase } from './coreSeed'

type Environment = Record<string, string | undefined>

interface RoleRow {
  id: number
  code: string
}

interface UserRow {
  id: number
  username: string
}

interface EmotionTypeRow {
  id: number
  code: string
}

export interface DemoSeedResult {
  accounts: string[]
  moods: number
}

export interface TestSeedResult {
  assessmentCode: string
}

const DEMO_USERS = [
  {
    username: 'demo_student',
    email: 'demo.student@example.invalid',
    nickname: '演示学生',
    roleCode: 'student',
  },
  {
    username: 'demo_counselor',
    email: 'demo.counselor@example.invalid',
    nickname: '演示心理工作人员',
    roleCode: 'counselor',
  },
  {
    username: 'demo_super_admin',
    email: 'demo.superadmin@example.invalid',
    nickname: '演示超级管理员',
    roleCode: 'super_admin',
  },
] as const

const DEMO_MOOD_PATTERN = [
  { daysAgo: 29, emotion: 'calm', intensity: 4, note: '虚构演示记录：完成课程复习后状态较平稳。' },
  { daysAgo: 24, emotion: 'anxious', intensity: 6, note: '虚构演示记录：临近期末时对复习安排有压力。' },
  { daysAgo: 18, emotion: 'happy', intensity: 7, note: '虚构演示记录：小组项目推进顺利。' },
  { daysAgo: 11, emotion: 'calm', intensity: 5, note: '虚构演示记录：晚间散步后情绪恢复。' },
  { daysAgo: 5, emotion: 'anxious', intensity: 5, note: '虚构演示记录：准备答辩材料时略有紧张。' },
] as const

const toMysqlDateTime = (date: Date): string => date.toISOString().slice(0, 23).replace('T', ' ')

const encryptSeedText = (text: string, encryptionKey: string): string => {
  const key = Buffer.from(encryptionKey, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string')
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  })
}

const requireDemoPassword = (env: Environment): string => {
  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('ALLOW_DEMO_SEED=true is required before running demo seed')
  }

  const password = env.DEMO_PASSWORD?.trim()
  if (!password) {
    throw new Error('DEMO_PASSWORD is required before running demo seed')
  }
  return password
}

const requireEncryptionKey = (env: Environment): string => {
  const key = env.ENCRYPTION_KEY?.trim()
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required before running demo seed')
  }
  return key
}

const readRoles = async (db: SeedDatabase): Promise<Map<string, number>> => {
  const rows = await db.query<RoleRow>('SELECT id, code FROM roles WHERE code IN (?, ?, ?)', [
    'student',
    'counselor',
    'super_admin',
  ])
  return new Map(rows.map((row) => [row.code, row.id]))
}

const readDemoUsers = async (db: SeedDatabase): Promise<Map<string, number>> => {
  const rows = await db.query<UserRow>('SELECT id, username FROM users WHERE username IN (?, ?, ?)', [
    'demo_student',
    'demo_counselor',
    'demo_super_admin',
  ])
  return new Map(rows.map((row) => [row.username, row.id]))
}

const readEmotionTypes = async (db: SeedDatabase): Promise<Map<string, number>> => {
  const rows = await db.query<EmotionTypeRow>('SELECT id, code FROM emotion_types WHERE code IN (?, ?, ?)', [
    'calm',
    'happy',
    'anxious',
  ])
  return new Map(rows.map((row) => [row.code, row.id]))
}

export const seedDemoData = async (
  db: SeedDatabase,
  env: Environment = process.env,
  now: Date = new Date()
): Promise<DemoSeedResult> => {
  const password = requireDemoPassword(env)
  const encryptionKey = requireEncryptionKey(env)
  const passwordHash = await bcrypt.hash(password, 12)
  const roles = await readRoles(db)
  const currentTime = toMysqlDateTime(now)

  for (const user of DEMO_USERS) {
    const roleId = roles.get(user.roleCode)
    if (!roleId) {
      throw new Error(`Reference role is missing before demo seed: ${user.roleCode}`)
    }

    await db.query(
      `INSERT INTO users (role_id, username, password_hash, email, nickname, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), password_hash = VALUES(password_hash), email = VALUES(email), nickname = VALUES(nickname), status = 'active', updated_at = VALUES(updated_at)`,
      [roleId, user.username, passwordHash, user.email, user.nickname, currentTime, currentTime]
    )
  }

  const demoUsers = await readDemoUsers(db)
  const studentId = demoUsers.get('demo_student')
  if (!studentId) {
    throw new Error('Demo student account was not created')
  }

  await db.query('DELETE FROM moods WHERE user_id IN (?, ?, ?)', [
    demoUsers.get('demo_student') ?? 0,
    demoUsers.get('demo_counselor') ?? 0,
    demoUsers.get('demo_super_admin') ?? 0,
  ])

  const emotionTypes = await readEmotionTypes(db)
  let moodCount = 0
  for (const item of DEMO_MOOD_PATTERN) {
    const recordedAt = new Date(now)
    recordedAt.setUTCDate(now.getUTCDate() - item.daysAgo)
    const emotionTypeId = emotionTypes.get(item.emotion)
    if (!emotionTypeId) {
      throw new Error(`Reference emotion type is missing before demo seed: ${item.emotion}`)
    }

    await db.query(
      `INSERT INTO moods (user_id, note_ciphertext, trigger_ciphertext, recorded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        encryptSeedText(item.note, encryptionKey),
        encryptSeedText('虚构演示触发因素', encryptionKey),
        toMysqlDateTime(recordedAt),
        currentTime,
        currentTime,
      ]
    )

    await db.query(
      `INSERT INTO mood_emotions (mood_id, emotion_type_id, intensity, is_primary)
       SELECT LAST_INSERT_ID(), ?, ?, 1`,
      [emotionTypeId, item.intensity]
    )
    moodCount += 1
  }

  return { accounts: DEMO_USERS.map((user) => user.username), moods: moodCount }
}

export const seedTestData = async (db: SeedDatabase, now: Date = new Date()): Promise<TestSeedResult> => {
  const currentTime = toMysqlDateTime(now)
  const checksum = crypto.createHash('sha256').update('TECHNICAL_FIXTURE:v1').digest('hex')

  await db.query(
    `INSERT INTO assessment_instruments (code, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), status = 'draft', updated_at = VALUES(updated_at)`,
    ['TECHNICAL_FIXTURE', '程序验证夹具', '仅用于自动化测试，不面向用户展示，不代表心理量表。', currentTime, currentTime]
  )

  await db.query(
    `INSERT INTO assessment_versions (instrument_id, version_label, language, target_population, theoretical_basis, source_citation, license_note, scoring_rule_json, risk_stratification_json, suggestion_template_json, status, checksum, created_at)
     SELECT id, ?, 'zh-CN', ?, ?, ?, ?, NULL, NULL, NULL, 'draft', ?, ?
     FROM assessment_instruments
     WHERE code = ?
     ON DUPLICATE KEY UPDATE status = 'draft', checksum = VALUES(checksum)`,
    ['v1', 'technical-test-only', 'none', 'internal fixture', 'not applicable', checksum, currentTime, 'TECHNICAL_FIXTURE']
  )

  return { assessmentCode: 'TECHNICAL_FIXTURE' }
}
