import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessage } from 'element-plus'
import { submitMoodRecord } from '@/api/mood'
import { useMoodRecordStore } from '@/stores/moodRecordStore'

vi.mock('@/api/mood', () => ({
  analyzeMoodWithRetry: vi.fn(),
  getMoodAdviceHistory: vi.fn(),
  saveMoodAdvice: vi.fn(),
  submitMoodRecord: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const submitMoodRecordMock = vi.mocked(submitMoodRecord)
const messageErrorMock = vi.mocked(ElMessage.error)

describe('moodRecordStore submit prerequisites', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    submitMoodRecordMock.mockReset()
    messageErrorMock.mockReset()
    localStorage.clear()
  })

  it('blocks submit without at least one selected mood type', async () => {
    const store = useMoodRecordStore()

    expect(store.canSubmit).toBe(false)
    await expect(store.submitRecord()).resolves.toBe(false)

    expect(submitMoodRecordMock).not.toHaveBeenCalled()
    expect(messageErrorMock).toHaveBeenCalledWith('请选择至少一种情绪类型')
  })

  it('blocks submit when intensity is outside the valid 1-10 range', async () => {
    const store = useMoodRecordStore()
    store.toggleMoodType('happy')
    store.intensity = 11

    expect(store.canSubmit).toBe(false)
    await expect(store.submitRecord()).resolves.toBe(false)

    expect(submitMoodRecordMock).not.toHaveBeenCalled()
    expect(messageErrorMock).toHaveBeenCalledWith('请选择 1-10 之间的情绪强度')
  })

  it('allows submit only when mood selection and intensity are valid', async () => {
    submitMoodRecordMock.mockResolvedValueOnce(null)
    const store = useMoodRecordStore()
    store.toggleMoodType('happy')
    store.intensity = 7

    expect(store.canSubmit).toBe(true)
    await expect(store.submitRecord()).resolves.toBe(true)

    expect(submitMoodRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moodType: ['happy'],
        intensity: 7,
        moodRatio: [7],
      })
    )
  })
})
