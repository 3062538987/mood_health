import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { getMoodRecordList } from '@/api/mood'
import request from '@/utils/request'
import { useUserStore } from '@/stores/userStore'

vi.mock('@/api/mood', () => ({
  getMoodRecordList: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
  RouterView: {
    name: 'RouterView',
    template: '<div />',
  },
}))

vi.mock('@/components/shared/AchievementNotification.vue', () => ({
  default: {
    name: 'AchievementNotification',
    template: '<div />',
  },
}))

vi.mock('@/components/shared/UserNotificationCenter.vue', () => ({
  default: { name: 'UserNotificationCenter', template: '<div />' },
}))

const getMoodRecordListMock = vi.mocked(getMoodRecordList)
const requestMock = vi.mocked(request)

const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
        RouterView: {
          template: '<div />',
        },
      },
    },
  })

describe('App authenticated mood fetch guard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    getMoodRecordListMock.mockReset()
    requestMock.mockReset()
  })

  it('does not fetch mood records when there is no token', async () => {
    mountApp()
    await flushPromises()

    expect(getMoodRecordListMock).not.toHaveBeenCalled()
  })

  it('does not fetch mood records when a token exists but user identity is not restored', async () => {
    localStorage.setItem('token', 'expired-token')
    setActivePinia(createPinia())

    mountApp()
    await flushPromises()

    expect(getMoodRecordListMock).not.toHaveBeenCalled()
  })

  it('does not fetch mood records after identity restoration fails and clears the token', async () => {
    localStorage.setItem('token', 'expired-token')
    setActivePinia(createPinia())
    requestMock.mockRejectedValueOnce(new Error('登录已过期，请重新登录'))
    const userStore = useUserStore()

    await userStore.fetchUserInfo()
    mountApp()
    await flushPromises()

    expect(userStore.token).toBe('')
    expect(getMoodRecordListMock).not.toHaveBeenCalled()
  })
})
