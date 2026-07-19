/**
 * AI 分析测试数据种子脚本
 * 为 demo_student 用户生成 30 天约 60 条情绪记录（分析结果由 AI 服务实时生成）
 */
import crypto from 'node:crypto'
import { SeedDatabase } from './coreSeed'

type Environment = Record<string, string | undefined>

interface EmotionTypeRow {
  id: number
  code: string
  name: string
}

interface TagRow {
  id: number
  code: string
}

interface UserRow {
  id: number
}

// ---- 情绪记录模板 ----
// 每天 1-3 条，覆盖 30 天，约 60 条
interface MoodTemplate {
  daysAgo: number
  emotions: Array<{ code: string; intensity: number }>
  tags: string[]
  note: string
}

const MOOD_TEMPLATES: MoodTemplate[] = [
  // 最近 7 天（密集数据，展示 7d 分析）
  { daysAgo: 0, emotions: [{ code: 'calm', intensity: 3 }], tags: ['study'], note: '今天复习效率不错，虽然有些累但整体感觉平稳。' },
  { daysAgo: 0, emotions: [{ code: 'tired', intensity: 5 }], tags: ['study'], note: '晚上感觉特别疲惫，可能是连续几天复习积累的。' },
  { daysAgo: 1, emotions: [{ code: 'happy', intensity: 7 }], tags: ['relationship'], note: '和朋友一起吃了晚饭，聊了很多开心的事，心情很好。' },
  { daysAgo: 1, emotions: [{ code: 'excited', intensity: 6 }], tags: ['career'], note: '收到了一家公司的面试邀请，既兴奋又有点紧张！' },
  { daysAgo: 2, emotions: [{ code: 'anxious', intensity: 6 }], tags: ['study', 'career'], note: '明天有重要考试，今天复习时感觉压力很大，总是担心准备不够。' },
  { daysAgo: 2, emotions: [{ code: 'calm', intensity: 4 }], tags: ['exercise'], note: '晚上去跑了步，运动后感觉焦虑缓解了不少。' },
  { daysAgo: 3, emotions: [{ code: 'sad', intensity: 5 }], tags: ['relationship'], note: '和朋友发生了点小误会，虽然解决了但心里还是有点不舒服。' },
  { daysAgo: 3, emotions: [{ code: 'anxious', intensity: 4 }], tags: ['study'], note: '考试结果还没出来，等待的过程有点煎熬。' },
  { daysAgo: 4, emotions: [{ code: 'irritable', intensity: 6 }], tags: ['sleep'], note: '昨晚失眠了，今天一整天都烦躁不安，做什么都提不起劲。' },
  { daysAgo: 4, emotions: [{ code: 'tired', intensity: 7 }], tags: ['sleep'], note: '连续两天睡眠不足，身体和精神都很疲惫。' },
  { daysAgo: 5, emotions: [{ code: 'happy', intensity: 8 }], tags: ['family'], note: '妈妈打电话来聊了很久，听到家人的声音感觉特别温暖。' },
  { daysAgo: 5, emotions: [{ code: 'calm', intensity: 3 }], tags: ['exercise'], note: '下午去健身房练了一小时，运动完出汗后感觉身心舒畅。' },
  { daysAgo: 6, emotions: [{ code: 'excited', intensity: 7 }], tags: ['relationship'], note: '和室友一起策划了一次周末短途旅行，超级期待！' },
  { daysAgo: 6, emotions: [{ code: 'anxious', intensity: 5 }], tags: ['career'], note: '看了几篇面经，越看越觉得自己准备不够充分。' },

  // 第 8-14 天
  { daysAgo: 7, emotions: [{ code: 'sad', intensity: 6 }], tags: ['family'], note: '有点想家了，看到朋友圈里大家都在晒回家的照片。' },
  { daysAgo: 7, emotions: [{ code: 'calm', intensity: 4 }], tags: ['study'], note: '晚上安静地看了会儿书，感觉内心平静了一些。' },
  { daysAgo: 8, emotions: [{ code: 'angry', intensity: 5 }], tags: ['relationship'], note: '小组作业有人不配合，沟通了多次都没用，很生气。' },
  { daysAgo: 8, emotions: [{ code: 'irritable', intensity: 4 }], tags: ['study'], note: '小组的事情影响了一整天的学习状态。' },
  { daysAgo: 9, emotions: [{ code: 'happy', intensity: 6 }], tags: ['exercise'], note: '今天跑步突破了自己的最佳记录，成就感满满！' },
  { daysAgo: 9, emotions: [{ code: 'calm', intensity: 3 }], tags: ['sleep'], note: '昨晚睡得不错，今天精神状态很好。' },
  { daysAgo: 10, emotions: [{ code: 'tired', intensity: 6 }], tags: ['study'], note: '今天课特别多，从早八上到晚六，感觉被掏空了。' },
  { daysAgo: 10, emotions: [{ code: 'anxious', intensity: 5 }], tags: ['career'], note: '看到同学们都在投简历，自己也开始焦虑了。' },
  { daysAgo: 11, emotions: [{ code: 'excited', intensity: 8 }], tags: ['relationship'], note: '朋友生日聚会，玩得很开心，好久没这么放松了！' },
  { daysAgo: 11, emotions: [{ code: 'happy', intensity: 5 }], tags: ['relationship'], note: '聚会结束后和几个好朋友又聊了很久，感觉很幸福。' },
  { daysAgo: 12, emotions: [{ code: 'sad', intensity: 4 }], tags: ['study'], note: '一门课的成绩出来了，不太理想，有点失落。' },
  { daysAgo: 12, emotions: [{ code: 'calm', intensity: 3 }], tags: ['exercise'], note: '晚饭后散步，秋天的晚风很舒服，心情慢慢平静下来。' },
  { daysAgo: 13, emotions: [{ code: 'anxious', intensity: 7 }], tags: ['study', 'career'], note: '期末临近，又要准备考试又要投简历，感觉压力山大。' },
  { daysAgo: 13, emotions: [{ code: 'irritable', intensity: 5 }], tags: ['sleep'], note: '压力大导致睡不好，睡不好导致更烦躁，恶性循环。' },
  { daysAgo: 14, emotions: [{ code: 'calm', intensity: 3 }], tags: ['exercise'], note: '今天给自己放了个假，去公园坐了一下午，放空自己。' },

  // 第 15-21 天
  { daysAgo: 15, emotions: [{ code: 'happy', intensity: 7 }], tags: ['career'], note: '面试通过了！虽然不是最想去的公司，但是个好的开始。' },
  { daysAgo: 15, emotions: [{ code: 'excited', intensity: 8 }], tags: ['family'], note: '第一时间打电话告诉了爸妈，他们也很高兴。' },
  { daysAgo: 16, emotions: [{ code: 'calm', intensity: 4 }], tags: ['study'], note: '今天按计划完成了复习任务，按部就班的感觉很好。' },
  { daysAgo: 16, emotions: [{ code: 'tired', intensity: 5 }], tags: ['study'], note: '虽然完成任务了，但高强度的学习还是让人疲惫。' },
  { daysAgo: 17, emotions: [{ code: 'irritable', intensity: 6 }], tags: ['relationship'], note: '和舍友因为卫生问题吵了一架，宿舍氛围现在很尴尬。' },
  { daysAgo: 17, emotions: [{ code: 'angry', intensity: 4 }], tags: ['relationship'], note: '冷静下来想想其实也不是什么大事，但当时就是控制不住。' },
  { daysAgo: 18, emotions: [{ code: 'sad', intensity: 5 }], tags: ['relationship'], note: '和舍友还没和好，回到宿舍感觉很压抑。' },
  { daysAgo: 18, emotions: [{ code: 'calm', intensity: 3 }], tags: ['study'], note: '去图书馆待了一天，换个环境心情好了一些。' },
  { daysAgo: 19, emotions: [{ code: 'happy', intensity: 6 }], tags: ['relationship'], note: '和舍友主动聊了聊，把话说开了，关系缓和了很多。' },
  { daysAgo: 19, emotions: [{ code: 'anxious', intensity: 5 }], tags: ['study'], note: '下周有两门考试，开始进入冲刺复习阶段。' },
  { daysAgo: 20, emotions: [{ code: 'tired', intensity: 7 }], tags: ['study', 'sleep'], note: '连续复习好几天，体力有点跟不上了。' },
  { daysAgo: 20, emotions: [{ code: 'calm', intensity: 4 }], tags: ['exercise'], note: '强迫自己去运动了一下，出完汗感觉好多了。' },
  { daysAgo: 21, emotions: [{ code: 'anxious', intensity: 6 }], tags: ['study'], note: '明天就考试了，今晚临时抱佛脚，感觉还有好多没复习到。' },

  // 第 22-29 天
  { daysAgo: 22, emotions: [{ code: 'excited', intensity: 8 }], tags: ['study'], note: '考完了！感觉发挥得还不错，终于可以松一口气了。' },
  { daysAgo: 22, emotions: [{ code: 'tired', intensity: 6 }], tags: ['sleep'], note: '考完试后紧绷的神经松下来，整个人都瘫了。' },
  { daysAgo: 23, emotions: [{ code: 'happy', intensity: 7 }], tags: ['relationship'], note: '和几个朋友一起出去大吃一顿庆祝考试结束！' },
  { daysAgo: 23, emotions: [{ code: 'calm', intensity: 3 }], tags: ['exercise'], note: '下午去打了篮球，好久没运动了，感觉身体都生锈了。' },
  { daysAgo: 24, emotions: [{ code: 'sad', intensity: 4 }], tags: ['family'], note: '奶奶打电话来说想我了，突然有点想哭。' },
  { daysAgo: 24, emotions: [{ code: 'calm', intensity: 5 }], tags: ['study'], note: '虽然考完了，但还有一门课的论文要交，继续努力。' },
  { daysAgo: 25, emotions: [{ code: 'anxious', intensity: 5 }], tags: ['career'], note: '又开始新一轮的投简历，这个过程真的很磨人。' },
  { daysAgo: 25, emotions: [{ code: 'irritable', intensity: 5 }], tags: ['sleep'], note: '最近作息又乱了，凌晨两三点才睡，白天精神很差。' },
  { daysAgo: 26, emotions: [{ code: 'happy', intensity: 6 }], tags: ['exercise'], note: '早起去晨跑，看到了很美的日出，感觉一天都充满了能量。' },
  { daysAgo: 26, emotions: [{ code: 'calm', intensity: 3 }], tags: ['study'], note: '论文终于写完了初稿，虽然还要改但总算迈出了第一步。' },
  { daysAgo: 27, emotions: [{ code: 'tired', intensity: 5 }], tags: ['study'], note: '改论文改到头昏脑胀，感觉每个字都要反复斟酌。' },
  { daysAgo: 27, emotions: [{ code: 'anxious', intensity: 4 }], tags: ['career'], note: '投了十几份简历都没回音，开始怀疑自己了。' },
  { daysAgo: 28, emotions: [{ code: 'sad', intensity: 5 }], tags: ['career'], note: '今天又收到一封拒信，虽然在意料之中但还是有点难过。' },
  { daysAgo: 28, emotions: [{ code: 'calm', intensity: 4 }], tags: ['relationship'], note: '朋友安慰我说找工作就是这样，好的在后面，心情好了一些。' },
  { daysAgo: 29, emotions: [{ code: 'angry', intensity: 5 }], tags: ['study'], note: '论文被导师退回来大改，改了好几版还不满意，很沮丧。' },
  { daysAgo: 29, emotions: [{ code: 'irritable', intensity: 6 }], tags: ['study'], note: '改论文改到崩溃，怀疑自己是不是不适合做学术。' },
]



// ---- 工具函数 ----
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

const requireEncryptionKey = (env: Environment): string => {
  const key = env.ENCRYPTION_KEY?.trim()
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required')
  }
  return key
}

const readEmotionTypes = async (db: SeedDatabase): Promise<Map<string, number>> => {
  const rows = await db.query<EmotionTypeRow>('SELECT id, code FROM emotion_types WHERE is_active = 1')
  return new Map(rows.map((row) => [row.code, row.id]))
}

const readSystemTags = async (db: SeedDatabase): Promise<Map<string, number>> => {
  const rows = await db.query<TagRow>('SELECT id, code FROM tags WHERE is_system = 1')
  return new Map(rows.map((row) => [row.code, row.id]))
}

const readDemoStudent = async (db: SeedDatabase): Promise<number> => {
  const rows = await db.query<UserRow>('SELECT id FROM users WHERE username = ?', ['demo_student'])
  if (rows.length === 0) {
    throw new Error('demo_student user not found. Run demo seed first.')
  }
  return rows[0].id
}

export interface AiAnalysisSeedResult {
  moods: number
}

export const seedAiAnalysisData = async (
  db: SeedDatabase,
  env: Environment = process.env,
  now: Date = new Date(),
): Promise<AiAnalysisSeedResult> => {
  const encryptionKey = requireEncryptionKey(env)
  const studentId = await readDemoStudent(db)
  const emotionTypes = await readEmotionTypes(db)
  const systemTags = await readSystemTags(db)
  const currentTime = toMysqlDateTime(now)

  console.log(`[seed:ai-analysis] demo_student id=${studentId}, emotionTypes=${emotionTypes.size}, tags=${systemTags.size}`)

  // ---- 清理旧数据 ----
  await db.query('DELETE FROM mood_analysis_versions WHERE user_id = ?', [studentId])
  await db.query(
    `DELETE FROM mood_emotions WHERE mood_id IN (SELECT id FROM moods WHERE user_id = ?)`,
    [studentId],
  )
  await db.query(
    `DELETE FROM mood_tags WHERE mood_id IN (SELECT id FROM moods WHERE user_id = ?)`,
    [studentId],
  )
  await db.query('DELETE FROM moods WHERE user_id = ?', [studentId])

  console.log('[seed:ai-analysis] 已清理旧数据')

  // ---- 插入情绪记录 ----
  let moodCount = 0
  const moodIds: number[] = []

  for (const template of MOOD_TEMPLATES) {
    const recordedAt = new Date(now)
    recordedAt.setUTCDate(now.getUTCDate() - template.daysAgo)
    const recordedAtStr = toMysqlDateTime(recordedAt)

    const encryptedNote = encryptSeedText(template.note, encryptionKey)
    const encryptedTrigger = encryptSeedText('', encryptionKey)

    // 插入 moods
    const [moodResult] = await db.query<{ insertId: number }>(
      `INSERT INTO moods (user_id, note_ciphertext, trigger_ciphertext, include_note, recorded_at, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [studentId, encryptedNote, encryptedTrigger, recordedAtStr, currentTime, currentTime],
    )

    // mysql2 返回 ResultSetHeader，insertId 可能在不同位置
    const moodId = (moodResult as any)?.insertId ?? (moodResult as any)?.id
    if (!moodId) {
      // fallback: 通过 LAST_INSERT_ID 获取
      const idRows = await db.query<{ id: number }>('SELECT LAST_INSERT_ID() as id')
      const fallbackId = idRows[0]?.id
      if (!fallbackId) {
        console.error(`[seed:ai-analysis] 无法获取 mood insertId for daysAgo=${template.daysAgo}`)
        continue
      }
      moodIds.push(fallbackId)
      await insertMoodEmotionsAndTags(db, fallbackId, template, emotionTypes, systemTags)
      moodCount++
      continue
    }

    moodIds.push(Number(moodId))
    await insertMoodEmotionsAndTags(db, Number(moodId), template, emotionTypes, systemTags)
    moodCount++
  }

  console.log(`[seed:ai-analysis] 已插入 ${moodCount} 条情绪记录`)

  return { moods: moodCount }
}

async function insertMoodEmotionsAndTags(
  db: SeedDatabase,
  moodId: number,
  template: MoodTemplate,
  emotionTypes: Map<string, number>,
  systemTags: Map<string, number>,
): Promise<void> {
  // 插入情绪关联
  for (let i = 0; i < template.emotions.length; i++) {
    const em = template.emotions[i]
    const emotionTypeId = emotionTypes.get(em.code)
    if (!emotionTypeId) {
      console.warn(`[seed:ai-analysis] 未知情绪类型: ${em.code}`)
      continue
    }
    await db.query(
      `INSERT INTO mood_emotions (mood_id, emotion_type_id, intensity, is_primary) VALUES (?, ?, ?, ?)`,
      [moodId, emotionTypeId, em.intensity, i === 0 ? 1 : 0],
    )
  }

  // 插入标签关联
  for (const tagCode of template.tags) {
    const tagId = systemTags.get(tagCode)
    if (!tagId) {
      console.warn(`[seed:ai-analysis] 未知标签: ${tagCode}`)
      continue
    }
    await db.query(
      `INSERT INTO mood_tags (mood_id, tag_id) VALUES (?, ?)`,
      [moodId, tagId],
    )
  }
}