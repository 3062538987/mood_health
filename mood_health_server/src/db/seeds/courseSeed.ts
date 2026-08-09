import { SeedDatabase } from './coreSeed'

const COURSE_DATA = [
  {
    title: '认识情绪：情绪从哪里来',
    description: '了解情绪的产生机制，学会识别和命名自己的情绪，掌握情绪觉察的入门技巧。',
    cover_url: '',
    content: '情绪是我们对内外刺激的自然反应，它包括生理反应、主观体验和外在表现三个层面。了解情绪从何而来，是情绪管理的第一步。',
    category: '心理知识',
    type: 'article',
  },
  {
    title: '情绪调节：如何与焦虑共处',
    description: '学习实用的情绪调节方法，包括呼吸法、正念练习和认知重构，帮你缓解日常焦虑。',
    cover_url: '',
    content: '焦虑是面对不确定性的正常反应，适度焦虑可以提高效率。但当焦虑过度时，可以用腹式呼吸、正念冥想和认知重构来调节。',
    category: '情绪调节',
    type: 'article',
  },
  {
    title: '人际关系：建立健康边界',
    description: '探索人际交往中的边界感，学会说"不"，建立互相尊重的关系模式。',
    cover_url: '',
    content: '健康的边界不是冷漠，而是对自己和他人的尊重。学会表达自己的需求，同时尊重他人的需求，是建立良好人际关系的基础。',
    category: '人际交往',
    type: 'article',
  },
  {
    title: '压力管理：从崩溃到从容',
    description: '识别压力源，学习时间管理和优先级排序，建立可持续的应对策略。',
    cover_url: '',
    content: '压力管理不是消除压力，而是学会与压力共处。通过识别压力源、合理安排时间、建立支持系统，你可以更好地应对生活挑战。',
    category: '情绪调节',
    type: 'article',
  },
  {
    title: '自我认知：发现真实的自己',
    description: '通过性格探索、价值观澄清和优势发现，逐步建立积极的自我认同。',
    cover_url: '',
    content: '自我认知是心理健康的核心。了解自己的性格特点、价值观和优势，可以帮助你做出更符合内心的选择，建立更真实的自我认同。',
    category: '心理知识',
    type: 'article',
  },
  {
    title: '沟通技巧：非暴力沟通入门',
    description: '学习观察-感受-需要-请求四步法，让日常沟通更顺畅、关系更亲密。',
    cover_url: '',
    content: '非暴力沟通强调观察而非评判、表达感受而非指责、明确需要而非抱怨、提出请求而非命令。这四步可以帮你建立更健康的沟通模式。',
    category: '人际交往',
    type: 'article',
  },
]

export interface CourseSeedResult {
  count: number
}

export const seedCourses = async (db: SeedDatabase): Promise<CourseSeedResult> => {
  const now = new Date().toISOString().slice(0, 23).replace('T', ' ')

  for (const course of COURSE_DATA) {
    await db.query(
      `INSERT INTO courses (title, description, cover_url, content, category, type, study_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), updated_at = VALUES(updated_at)`,
      [course.title, course.description, course.cover_url, course.content, course.category, course.type, now, now]
    )
  }

  return { count: COURSE_DATA.length }
}