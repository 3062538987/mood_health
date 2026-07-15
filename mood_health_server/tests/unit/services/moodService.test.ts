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
})
