import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserNotificationCenter from '@/components/shared/UserNotificationCenter.vue'
import { useUserStore } from '@/stores/userStore'
import { listNotifications, markNotificationRead } from '@/api/notifications'

const notificationMock = vi.hoisted(() => vi.fn())

vi.mock('element-plus', () => ({ ElNotification: notificationMock }))
vi.mock('@/utils/request', () => ({ default: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/notifications', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}))

describe('UserNotificationCenter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(markNotificationRead).mockResolvedValue({ read: true })
  })

  it('pops and marks each unread server notification exactly once', async () => {
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: 9,
        notificationType: 'emotion_reminder',
        title: '记录一下此刻的心情',
        message: '今天还没有情绪记录。',
        actionPath: '/mood/record',
        scheduledFor: new Date().toISOString(),
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ])
    const store = useUserStore()
    store.user = { id: 1, username: 'demo', email: 'demo@example.com' }

    mount(UserNotificationCenter)
    await flushPromises()

    expect(notificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: '记录一下此刻的心情' })
    )
    expect(markNotificationRead).toHaveBeenCalledWith(9)
  })

  it('aborts an in-flight poll before logout without reporting an error', async () => {
    let observedSignal: AbortSignal | undefined
    vi.mocked(listNotifications).mockImplementation(
      (signal) =>
        new Promise((_, reject) => {
          observedSignal = signal
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = useUserStore()
    store.user = { id: 1, username: 'demo', email: 'demo@example.com' }

    const wrapper = mount(UserNotificationCenter)
    await flushPromises()
    store.logoutInProgress = true
    await flushPromises()

    expect(observedSignal?.aborted).toBe(true)
    expect(errorSpy).not.toHaveBeenCalled()
    wrapper.unmount()
    errorSpy.mockRestore()
  })
})
