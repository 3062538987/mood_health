import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import MoodRecord from '@/views/mood/MoodRecord.vue'
import { useMoodRecordStore } from '@/stores/moodRecordStore'

// Mock API 模块
vi.mock('@/api/mood', () => ({
  analyzeMoodWithRetry: vi.fn(),
  getMoodAdviceHistory: vi.fn(),
  saveMoodAdvice: vi.fn(),
  submitMoodRecord: vi.fn(),
  getMoodTypeEnum: vi.fn().mockResolvedValue([
    { label: 'happy', id: 1, name: '开心', icon: '😊' },
    { label: 'sad', id: 2, name: '难过', icon: '😢' },
    { label: 'angry', id: 3, name: '生气', icon: '😡' },
    { label: 'anxious', id: 4, name: '焦虑', icon: '😰' },
    { label: 'calm', id: 5, name: '平静', icon: '😌' },
  ]),
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
    const wrapper = mount(MoodRecord, {
      global: {
        stubs: {
          'el-skeleton': true,
          'el-button': true,
          'el-empty': true,
          'MoodAlert': true,
          'MoodComparison': true,
        },
      },
    })
    const store = useMoodRecordStore()

    // 等待组件加载完成 (pageLoading -> false)
    await flushPromises()

    const submitButton = () => wrapper.find('.submit-action')

    expect(submitButton().exists()).toBe(true)
    expect(submitButton().attributes('disabled')).toBeDefined()

    store.toggleMoodType('happy')
    await wrapper.vm.$nextTick()
    expect(submitButton().attributes('disabled')).toBeUndefined()

    store.intensity = Number.NaN
    await wrapper.vm.$nextTick()
    expect(submitButton().attributes('disabled')).toBeDefined()
  })
})