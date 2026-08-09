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

const TECHNICAL_TEST_ITEMS = [
  {
    order: 1,
    text: '最近两周，您是否感到情绪低落、沮丧或绝望？',
    type: 'single_choice',
  },
  {
    order: 2,
    text: '最近两周，您是否对做事缺乏兴趣或乐趣？',
    type: 'single_choice',
  },
  {
    order: 3,
    text: '最近两周，您是否感到紧张、焦虑或无法放松？',
    type: 'single_choice',
  },
  {
    order: 4,
    text: '最近两周，您是否因为担忧而影响睡眠？',
    type: 'single_choice',
  },
  {
    order: 5,
    text: '最近两周，您是否感到精力不足或疲惫？',
    type: 'single_choice',
  },
] as const

const TECHNICAL_OPTIONS_JSON = JSON.stringify([
  { label: '从不', value: 0 },
  { label: '几天', value: 1 },
  { label: '一半以上', value: 2 },
  { label: '几乎每天', value: 3 },
])

const SCORING_RULE_JSON = JSON.stringify({
  type: 'sum',
  min_score: 0,
  max_score: 15,
  reverse_items: [],
})

const RISK_STRATIFICATION_JSON = JSON.stringify({
  levels: [
    { label: '低风险', range: [0, 4], color: 'green' },
    { label: '中风险', range: [5, 8], color: 'yellow' },
    { label: '高风险', range: [9, 12], color: 'orange' },
    { label: '极高风险', range: [13, 15], color: 'red' },
  ],
})

const SUGGESTION_TEMPLATE_JSON = JSON.stringify({
  levels: {
    '低风险': '您的情绪状态整体良好，建议保持当前的生活节奏和社交活动。',
    '中风险': '您近期可能有一些情绪波动，建议关注自己的睡眠和作息规律，适当增加体育锻炼。',
    '高风险': '您近期的情绪状态值得关注，建议与信任的人聊聊，或联系学校心理咨询中心。',
    '极高风险': '您近期的情绪困扰较为明显，强烈建议尽快联系学校心理咨询中心或拨打心理援助热线。',
  },
})

export const seedTestData = async (db: SeedDatabase, now: Date = new Date()): Promise<TestSeedResult> => {
  const currentTime = toMysqlDateTime(now)
  const checksum = crypto.createHash('sha256').update('TECHNICAL_FIXTURE:v2').digest('hex')

  await db.query(
    `INSERT INTO assessment_instruments (code, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), status = 'active', updated_at = VALUES(updated_at)`,
    [
      'TECHNICAL_FIXTURE',
      '情绪状态快速筛查',
      '技术测试量表（5 题），用于验证测评流程，不代表真实心理量表。',
      currentTime,
      currentTime,
    ]
  )

  await db.query(
    `DELETE FROM assessment_items
     WHERE assessment_version_id IN (
       SELECT id FROM assessment_versions
       WHERE instrument_id = (SELECT id FROM assessment_instruments WHERE code = ?)
     )`,
    ['TECHNICAL_FIXTURE']
  )

  await db.query(
    `INSERT INTO assessment_versions (instrument_id, version_label, language, target_population, theoretical_basis, source_citation, license_note, scoring_rule_json, risk_stratification_json, suggestion_template_json, status, checksum, created_at)
     SELECT id, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?
     FROM assessment_instruments
     WHERE code = ?
     ON DUPLICATE KEY UPDATE
       scoring_rule_json = VALUES(scoring_rule_json),
       risk_stratification_json = VALUES(risk_stratification_json),
       suggestion_template_json = VALUES(suggestion_template_json),
       status = 'active',
       checksum = VALUES(checksum)`,
    [
      'v1',
      '大学生（技术测试）',
      '技术测试夹具，不代表任何正式心理量表理论。',
      '内部技术测试，非正式量表。',
      '技术测试用途，无正式授权。',
      SCORING_RULE_JSON,
      RISK_STRATIFICATION_JSON,
      SUGGESTION_TEMPLATE_JSON,
      checksum,
      currentTime,
      'TECHNICAL_FIXTURE',
    ]
  )

  for (const item of TECHNICAL_TEST_ITEMS) {
    await db.query(
      `INSERT INTO assessment_items (assessment_version_id, item_order, item_text, item_type, options_json, reverse_scored, created_at)
       SELECT av.id, ?, ?, ?, ?, 0, ?
       FROM assessment_versions av
       JOIN assessment_instruments ai ON ai.id = av.instrument_id
       WHERE ai.code = ? AND av.version_label = 'v1'
       ON DUPLICATE KEY UPDATE item_text = VALUES(item_text), item_type = VALUES(item_type), options_json = VALUES(options_json)`,
      [item.order, item.text, item.type, TECHNICAL_OPTIONS_JSON, currentTime, 'TECHNICAL_FIXTURE']
    )
  }

  return { assessmentCode: 'TECHNICAL_FIXTURE' }
}
