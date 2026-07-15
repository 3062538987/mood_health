import { createMoodService } from '../../../src/services/moodService'
import { MoodRepository } from '../../../src/repositories/moodRepository'

const createRepository = (): jest.Mocked<MoodRepository> => ({
  createMood: jest.fn(),
  listByUser: jest.fn(),
  listByUserAndEmotionType: jest.fn(),
  countByUser: jest.fn(),
  countByUserAndEmotionType: jest.fn(),
  updateMood: jest.fn(),
  deleteMood: jest.fn(),
  listEmotionTypes: jest.fn(),
  listTags: jest.fn(),
  createOrGetTag: jest.fn(),
})

describe('moodService', () => {
  it('encrypts note and trigger before creating a mood with one primary emotion', async () => {
    const repository = createRepository()
    repository.createMood.mockResolvedValue(21)
    const encryptField = jest.fn((value: string | null | undefined) => (value ? 'encrypted-value' : null))
    const service = createMoodService({ repository, encryptField })

    const moodId = await service.recordMood({
      userId: 7,
      note: '今天考试压力很大',
      trigger: '期末复习',
      recordedAt: new Date('2026-07-15T10:00:00.000Z'),
      emotions: [
        { emotionTypeId: 3, intensity: 8, isPrimary: true },
        { emotionTypeId: 4, intensity: 5 },
      ],
      tagIds: [1, 2],
    })

    expect(moodId).toBe(21)
    expect(repository.createMood).toHaveBeenCalledWith({
      userId: 7,
      noteCiphertext: 'encrypted-value',
      triggerCiphertext: 'encrypted-value',
      recordedAt: new Date('2026-07-15T10:00:00.000Z'),
      emotions: [
        { emotionTypeId: 3, intensity: 8, isPrimary: true },
        { emotionTypeId: 4, intensity: 5, isPrimary: false },
      ],
      tagIds: [1, 2],
    })
    expect(JSON.stringify(repository.createMood.mock.calls)).not.toContain('今天考试压力很大')
  })

  it('rejects empty emotion lists and out-of-range intensity', async () => {
    const service = createMoodService({
      repository: createRepository(),
      encryptField: jest.fn(),
    })

    await expect(
      service.recordMood({
        userId: 7,
        note: '',
        trigger: '',
        recordedAt: new Date(),
        emotions: [],
        tagIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 400 })

    await expect(
      service.recordMood({
        userId: 7,
        note: '',
        trigger: '',
        recordedAt: new Date(),
        emotions: [{ emotionTypeId: 1, intensity: 11 }],
        tagIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects multiple primary emotions', async () => {
    const service = createMoodService({
      repository: createRepository(),
      encryptField: jest.fn(),
    })

    await expect(
      service.recordMood({
        userId: 7,
        note: '',
        trigger: '',
        recordedAt: new Date(),
        emotions: [
          { emotionTypeId: 1, intensity: 5, isPrimary: true },
          { emotionTypeId: 2, intensity: 6, isPrimary: true },
        ],
        tagIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('lists moods by decrypting ciphertext and preserving pagination metadata', async () => {
    const repository = createRepository()
    repository.listByUser.mockResolvedValue([
      {
        id: 15,
        userId: 7,
        noteCiphertext: 'encrypted-note',
        triggerCiphertext: 'encrypted-trigger',
        recordedAt: new Date('2026-07-15T10:00:00.000Z'),
        createdAt: new Date('2026-07-15T10:01:00.000Z'),
        updatedAt: new Date('2026-07-15T10:02:00.000Z'),
        emotions: [
          {
            emotionTypeId: 1,
            code: 'anxious',
            name: '焦虑',
            icon: 'activity',
            intensity: 8,
            isPrimary: true,
          },
        ],
        tags: [{ id: 3, code: 'study', name: '学习', isSystem: true }],
      },
    ])
    repository.countByUser.mockResolvedValue(1)
    const decryptField = jest.fn((value: string | null | undefined) => {
      if (value === 'encrypted-note') return '今天压力很大'
      if (value === 'encrypted-trigger') return '期末复习'
      return null
    })
    const service = createMoodService({
      repository,
      encryptField: jest.fn(),
      decryptField,
    })

    const result = await service.listMoods(7, { page: 1, limit: 10 })

    expect(repository.listByUser).toHaveBeenCalledWith(7, { page: 1, limit: 10 })
    expect(repository.countByUser).toHaveBeenCalledWith(7)
    expect(result).toEqual({
      list: [
        {
          id: '15',
          userId: '7',
          moodType: ['焦虑'],
          moodRatio: [80],
          emotions: [
            {
              emotionTypeId: 1,
              name: '焦虑',
              icon: 'activity',
              intensity: 8,
              isPrimary: true,
            },
          ],
          tags: ['学习'],
          tagIds: [3],
          event: '今天压力很大',
          trigger: '期末复习',
          createTime: '2026-07-15T10:01:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })
  })

  it('lists moods filtered by emotion type when requested', async () => {
    const repository = createRepository()
    repository.listByUserAndEmotionType.mockResolvedValue([])
    repository.countByUserAndEmotionType.mockResolvedValue(0)
    const service = createMoodService({
      repository,
      encryptField: jest.fn(),
      decryptField: jest.fn(),
    })

    const result = await service.listMoods(7, { page: 1, limit: 10, emotionTypeId: 2 })

    expect(repository.listByUserAndEmotionType).toHaveBeenCalledWith(7, 2, {
      page: 1,
      limit: 10,
      emotionTypeId: 2,
    })
    expect(repository.countByUserAndEmotionType).toHaveBeenCalledWith(7, 2)
    expect(repository.listByUser).not.toHaveBeenCalled()
    expect(repository.countByUser).not.toHaveBeenCalled()
    expect(result).toEqual({ list: [], total: 0, page: 1, limit: 10 })
  })

  it('encrypts note and trigger before updating a mood inside the user boundary', async () => {
    const repository = createRepository()
    repository.updateMood.mockResolvedValue(true)
    const encryptField = jest.fn((value: string | null | undefined) => (value ? 'encrypted-value' : null))
    const service = createMoodService({ repository, encryptField })

    const updated = await service.updateMood({
      id: 15,
      userId: 7,
      note: '更新后的记录',
      trigger: '复盘',
      recordedAt: new Date('2026-07-15T11:00:00.000Z'),
      emotions: [{ emotionTypeId: 2, intensity: 6, isPrimary: true }],
      tagIds: [4],
    })

    expect(updated).toBe(true)
    expect(repository.updateMood).toHaveBeenCalledWith({
      id: 15,
      userId: 7,
      noteCiphertext: 'encrypted-value',
      triggerCiphertext: 'encrypted-value',
      recordedAt: new Date('2026-07-15T11:00:00.000Z'),
      emotions: [{ emotionTypeId: 2, intensity: 6, isPrimary: true }],
      tagIds: [4],
    })
    expect(JSON.stringify(repository.updateMood.mock.calls)).not.toContain('更新后的记录')
  })

  it('rejects invalid update payloads before calling the repository', async () => {
    const repository = createRepository()
    const service = createMoodService({
      repository,
      encryptField: jest.fn(),
    })

    await expect(
      service.updateMood({
        id: 15,
        userId: 7,
        note: '',
        trigger: '',
        recordedAt: new Date(),
        emotions: [{ emotionTypeId: 1, intensity: 0 }],
        tagIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(repository.updateMood).not.toHaveBeenCalled()
  })

  it('deletes a mood through the repository user boundary', async () => {
    const repository = createRepository()
    repository.deleteMood.mockResolvedValue(true)
    const service = createMoodService({ repository })

    await expect(service.deleteMood(7, 15)).resolves.toBe(true)

    expect(repository.deleteMood).toHaveBeenCalledWith(7, 15)
  })

  it('lists emotion types with the existing controller DTO shape', async () => {
    const repository = createRepository()
    repository.listEmotionTypes.mockResolvedValue([
      { id: 1, code: 'happy', name: '快乐', icon: 'smile', category: 'positive', sortOrder: 10 },
    ])
    const service = createMoodService({ repository })

    await expect(service.listEmotionTypes()).resolves.toEqual([
      { id: 1, name: '快乐', icon: 'smile', category: 'positive' },
    ])
  })

  it('lists tags with legacy user_id and is_system field names for frontend compatibility', async () => {
    const repository = createRepository()
    repository.listTags.mockResolvedValue([
      { id: 2, code: 'study', userId: null, name: '学习', isSystem: true },
      { id: 3, code: null, userId: 7, name: '自定义', isSystem: false },
    ])
    const service = createMoodService({ repository })

    await expect(service.listTags(7)).resolves.toEqual([
      { id: 2, name: '学习', user_id: null, is_system: true },
      { id: 3, name: '自定义', user_id: 7, is_system: false },
    ])
  })

  it('trims custom tag names before create-or-get', async () => {
    const repository = createRepository()
    repository.createOrGetTag.mockResolvedValue(9)
    const service = createMoodService({ repository })

    await expect(service.createOrGetTag('  新标签  ', 7)).resolves.toEqual({ id: 9, name: '新标签' })

    expect(repository.createOrGetTag).toHaveBeenCalledWith('新标签', 7)
  })
})
