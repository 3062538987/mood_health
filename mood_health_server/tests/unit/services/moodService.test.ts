import { createMoodService } from '../../../src/services/moodService'
import { MoodRepository } from '../../../src/repositories/moodRepository'

const createRepository = (): jest.Mocked<MoodRepository> => ({
  createMood: jest.fn(),
  listByUser: jest.fn(),
  countByUser: jest.fn(),
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
})
