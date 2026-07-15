import { createMoodRepository, MoodEmotionInput, MoodRepository } from '../repositories/moodRepository'
import { BusinessError } from '../utils/errors'

type EncryptField = (value: string | null | undefined) => string | null

export interface RecordMoodEmotionInput {
  emotionTypeId: number
  intensity: number
  isPrimary?: boolean
}

export interface RecordMoodInput {
  userId: number
  note: string | null
  trigger: string | null
  recordedAt: Date
  emotions: RecordMoodEmotionInput[]
  tagIds: number[]
}

interface MoodServiceDependencies {
  repository?: MoodRepository
  encryptField?: EncryptField
}

const normalizeEmotions = (emotions: RecordMoodEmotionInput[]): MoodEmotionInput[] => {
  if (!Array.isArray(emotions) || emotions.length === 0) {
    throw new BusinessError('至少需要选择一种情绪')
  }

  let primaryCount = 0
  const normalized = emotions.map((emotion, index) => {
    if (!Number.isInteger(emotion.emotionTypeId) || emotion.emotionTypeId <= 0) {
      throw new BusinessError('情绪类型无效')
    }

    if (!Number.isInteger(emotion.intensity) || emotion.intensity < 1 || emotion.intensity > 10) {
      throw new BusinessError('情绪强度必须在 1-10 之间')
    }

    const isPrimary = emotion.isPrimary ?? index === 0
    if (isPrimary) {
      primaryCount += 1
    }

    return {
      emotionTypeId: emotion.emotionTypeId,
      intensity: emotion.intensity,
      isPrimary,
    }
  })

  if (primaryCount > 1) {
    throw new BusinessError('一条情绪记录最多只能有一个主要情绪')
  }

  return normalized
}

export const createMoodService = (dependencies: MoodServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createMoodRepository()
  const encryptField =
    dependencies.encryptField ??
    ((value: string | null | undefined) => {
      const { encryptField: encryptFieldUtil } = require('../utils/encryption') as {
        encryptField: EncryptField
      }
      return encryptFieldUtil(value)
    })

  const recordMood = async (input: RecordMoodInput): Promise<number> => {
    const emotions = normalizeEmotions(input.emotions)

    return repository.createMood({
      userId: input.userId,
      noteCiphertext: encryptField(input.note),
      triggerCiphertext: encryptField(input.trigger),
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })
  }

  return {
    recordMood,
  }
}

export type MoodService = ReturnType<typeof createMoodService>
