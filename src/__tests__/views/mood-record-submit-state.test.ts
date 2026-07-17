import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import MoodRecord from '@/views/mood/MoodRecord.vue'
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

describe('MoodRecord submit button state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('keeps submit disabled until a mood and valid intensity are present', async () => {
    const wrapper = mount(MoodRecord)
    const store = useMoodRecordStore()
    const submitButton = () => wrapper.find('.submit-action')

    expect(submitButton().attributes('disabled')).toBeDefined()

    store.toggleMoodType('happy')
    await wrapper.vm.$nextTick()
    expect(submitButton().attributes('disabled')).toBeUndefined()

    store.intensity = Number.NaN
    await wrapper.vm.$nextTick()
    expect(submitButton().attributes('disabled')).toBeDefined()
  })
})
