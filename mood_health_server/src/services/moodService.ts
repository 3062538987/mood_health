import { createMoodRepository, MoodEmotionInput, MoodRepository } from '../repositories/moodRepository'
import { BusinessError } from '../utils/errors'

type EncryptField = (value: string | null | undefined) => string | null
type DecryptField = (value: string | null | undefined) => string | null

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

export interface UpdateMoodServiceInput extends RecordMoodInput {
  id: number
}

interface MoodServiceDependencies {
  repository?: MoodRepository
  encryptField?: EncryptField
  decryptField?: DecryptField
}

export interface ListMoodOptions {
  page: number
  limit: number
  emotionTypeId?: number
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
  const decryptField =
    dependencies.decryptField ??
    ((value: string | null | undefined) => {
      const { decryptField: decryptFieldUtil } = require('../utils/encryption') as {
        decryptField: DecryptField
      }
      return decryptFieldUtil(value)
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

  const listMoods = async (userId: number, options: ListMoodOptions) => {
    const shouldFilterByEmotion =
      Number.isInteger(options.emotionTypeId) && Number(options.emotionTypeId) > 0
    const [moods, total] = await Promise.all([
      shouldFilterByEmotion
        ? repository.listByUserAndEmotionType(userId, Number(options.emotionTypeId), options)
        : repository.listByUser(userId, options),
      shouldFilterByEmotion
        ? repository.countByUserAndEmotionType(userId, Number(options.emotionTypeId))
        : repository.countByUser(userId),
    ])

    return {
      list: moods.map((mood) => ({
        id: mood.id.toString(),
        userId: mood.userId.toString(),
        moodType: mood.emotions.map((emotion) => emotion.name),
        moodRatio: mood.emotions.map((emotion) => emotion.intensity * 10),
        emotions: mood.emotions.map((emotion) => ({
          emotionTypeId: emotion.emotionTypeId,
          name: emotion.name,
          icon: emotion.icon,
          intensity: emotion.intensity,
          isPrimary: emotion.isPrimary,
        })),
        tags: mood.tags.map((tag) => tag.name),
        tagIds: mood.tags.map((tag) => tag.id),
        event: decryptField(mood.noteCiphertext) || '',
        trigger: decryptField(mood.triggerCiphertext) || '',
        createTime: mood.createdAt.toISOString(),
      })),
      total,
      page: options.page,
      limit: options.limit,
    }
  }

  const updateMood = async (input: UpdateMoodServiceInput): Promise<boolean> => {
    const emotions = normalizeEmotions(input.emotions)

    return repository.updateMood({
      id: input.id,
      userId: input.userId,
      noteCiphertext: encryptField(input.note),
      triggerCiphertext: encryptField(input.trigger),
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })
  }

  const deleteMood = async (userId: number, moodId: number): Promise<boolean> => {
    return repository.deleteMood(userId, moodId)
  }

  const listEmotionTypes = async () => {
    const emotionTypes = await repository.listEmotionTypes()

    return emotionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      category: type.category,
    }))
  }

  const listTags = async (userId: number) => {
    const tags = await repository.listTags(userId)

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      user_id: tag.userId,
      is_system: tag.isSystem,
    }))
  }

  const createOrGetTag = async (name: string, userId: number) => {
    const trimmedName = name.trim()
    const id = await repository.createOrGetTag(trimmedName, userId)

    return { id, name: trimmedName }
  }

  return {
    recordMood,
    listMoods,
    updateMood,
    deleteMood,
    listEmotionTypes,
    listTags,
    createOrGetTag,
  }
}

export type MoodService = ReturnType<typeof createMoodService>
