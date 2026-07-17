import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '@/views/Home.vue'
import { useMoodStore } from '@/stores/moodStore'
import { useUserStore } from '@/stores/userStore'
import type { MoodRecord } from '@/types/mood'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

vi.mock('@/api/mood', () => ({
  getMoodRecordList: vi.fn(),
  getMoodWeeklyReport: vi.fn(),
  submitMoodRecord: vi.fn(),
}))

const createMoodRecord = (): MoodRecord => ({
  id: '1',
  userId: '7',
  moodType: ['calm'],
  moodRatio: [100],
  intensity: 5,
  event: '完成一次记录',
  tags: [],
  trigger: '',
  createTime: new Date().toISOString(),
})

const mountHome = () =>
  mount(Home, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === `string` ? to : to.path"><slot /></a>',
        },
      },
    },
  })

const loginUser = () => {
  const userStore = useUserStore()
  userStore.user = {
    id: 7,
    username: 'student',
    email: 'student@example.com',
    role: 'user',
  }
  userStore.token = 'token'
}

const markMoodListLoaded = () => {
  const moodStore = useMoodStore() as ReturnType<typeof useMoodStore> & {
    hasFetchedMoodList: boolean
  }
  moodStore.hasFetchedMoodList = true
  return moodStore
}

describe('Home first-record onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('does not show onboarding before mood data has loaded', () => {
    loginUser()

    const wrapper = mountHome()

    expect(wrapper.find('.first-record-onboarding').exists()).toBe(false)
  })

  it('shows a first-record action only after an authenticated empty mood list is loaded', () => {
    loginUser()
    markMoodListLoaded()

    const wrapper = mountHome()

    const onboarding = wrapper.get('.first-record-onboarding')
    expect(onboarding.text()).toContain('记录第一条情绪')
    expect(onboarding.text()).not.toContain('量表')
    expect(wrapper.get('.onboarding-action').attributes('href')).toBe('/mood/record')
  })

  it('does not show onboarding for guests, loading state, failed requests, or existing records', () => {
    let moodStore = markMoodListLoaded()
    expect(mountHome().find('.first-record-onboarding').exists()).toBe(false)

    loginUser()
    moodStore = markMoodListLoaded()
    moodStore.loading = true
    expect(mountHome().find('.first-record-onboarding').exists()).toBe(false)

    moodStore.loading = false
    moodStore.error = '获取列表失败'
    expect(mountHome().find('.first-record-onboarding').exists()).toBe(false)

    moodStore.error = ''
    moodStore.moodRecords = [createMoodRecord()]
    expect(mountHome().find('.first-record-onboarding').exists()).toBe(false)
  })
})
