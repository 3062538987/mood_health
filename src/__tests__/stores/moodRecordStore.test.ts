import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMoodRecordStore } from '@/stores/moodRecordStore'

const apiMocks = vi.hoisted(() => ({
  analyzeMoodWithRetry: vi.fn(),
  getMoodAdviceHistory: vi.fn(),
  getMoodTypeEnum: vi.fn(),
  saveMoodAdvice: vi.fn(),
  submitMoodRecord: vi.fn(),
}))

const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/api/mood', () => ({
  analyzeMoodWithRetry: apiMocks.analyzeMoodWithRetry,
  getMoodAdviceHistory: apiMocks.getMoodAdviceHistory,
  getMoodTypeEnum: apiMocks.getMoodTypeEnum,
  saveMoodAdvice: apiMocks.saveMoodAdvice,
  submitMoodRecord: apiMocks.submitMoodRecord,
}))

vi.mock('element-plus', () => ({
  ElMessage: messageMocks,
}))

describe('moodRecordStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    apiMocks.getMoodTypeEnum.mockResolvedValue([
      { id: 1, code: 'happy', name: '快乐', icon: 'smile', category: 'positive' },
      { id: 2, code: 'delight', name: '愉悦', icon: 'sun', category: 'positive' },
      { id: 3, code: 'neutral', name: '一般', icon: 'meh', category: 'neutral' },
    ])
    // A2-05: submitRecord 现在返回 { recordId, analysisJob } 格式
    apiMocks.submitMoodRecord.mockResolvedValue({ recordId: 1, analysisJob: null } as any)
  })

  it('maps selected frontend emotion codes to backend emotion type ids before submit', async () => {
    const store = useMoodRecordStore()

    await store.initializePage()
    store.toggleMoodType('happy')
    store.toggleMoodType('delight')
    store.moodContent = '完成课程作业后感觉不错'
    store.addTrigger('学习')
    store.toggleTag('有成就感')

    await expect(store.submitRecord()).resolves.toBe(true)

    expect(apiMocks.submitMoodRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        moodType: ['happy', 'delight'],
        intensity: 6,
      })
    )
  })
})
