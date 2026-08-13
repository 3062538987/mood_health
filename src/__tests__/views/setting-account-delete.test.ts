import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Setting from '@/views/user/Setting.vue'
import { useUserStore } from '@/stores/userStore'
import { deleteCurrentAccount } from '@/api/auth'
import {
  createTestNotification,
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/api/notifications'

const elementMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  deleteCurrentAccount: vi.fn(),
}))

vi.mock('@/api/notifications', () => ({
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
  createTestNotification: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: elementMocks.success,
    error: elementMocks.error,
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
}))

vi.mock('@/utils/sound', () => ({
  default: {
    setSoundEnabled: vi.fn(),
  },
}))

const deleteCurrentAccountMock = vi.mocked(deleteCurrentAccount)
const getNotificationPreferencesMock = vi.mocked(getNotificationPreferences)
const saveNotificationPreferencesMock = vi.mocked(saveNotificationPreferences)
const createTestNotificationMock = vi.mocked(createTestNotification)
const serverPreferences = {
  reminderTime: '20:00',
  weeklyReportEnabled: true,
  gameSoundEnabled: true,
  emotionReminderEnabled: true,
  weeklyReportNotificationEnabled: true,
  groupActivityEnabled: true,
  treeholeReplyEnabled: true,
  featureUpdateEnabled: true,
}

const mountSetting = () => {
  const wrapper = mount(Setting)
  const store = useUserStore()
  store.token = 'jwt-token'
  store.user = {
    id: 1,
    username: 'student_demo',
    email: 'student@example.com',
    role: 'student',
  }
  return { wrapper, store }
}

describe('Setting account deletion flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    getNotificationPreferencesMock.mockResolvedValue({ ...serverPreferences })
    saveNotificationPreferencesMock.mockImplementation(async (value) => value)
    createTestNotificationMock.mockResolvedValue({
      id: 1,
      notificationType: 'test',
      title: '提醒测试成功',
      message: '这是由服务端生成的真实站内提醒。',
      actionPath: '/user/setting',
      scheduledFor: new Date().toISOString(),
      readAt: null,
      createdAt: new Date().toISOString(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports a single success message when preference settings are saved', async () => {
    const { wrapper } = mountSetting()

    await wrapper.findAll('input[type="checkbox"]')[0].setValue(false)

    expect(elementMocks.success).toHaveBeenCalledTimes(1)
    expect(elementMocks.success).toHaveBeenCalledWith('设置已保存')
    expect(elementMocks.error).not.toHaveBeenCalled()
  })

  it('restores preference settings when server save fails', async () => {
    const { wrapper } = mountSetting()
    await flushPromises()
    saveNotificationPreferencesMock.mockRejectedValueOnce(new Error('server failed'))

    const weeklyReportInput = wrapper.findAll('input[type="checkbox"]')[0]
    await weeklyReportInput.setValue(false)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect((wrapper.findAll('input[type="checkbox"]')[0].element as HTMLInputElement).checked).toBe(
      true
    )
    expect(elementMocks.error).toHaveBeenCalledTimes(1)
    expect(elementMocks.error).toHaveBeenCalledWith('设置保存失败，已恢复原值')
    expect(elementMocks.success).not.toHaveBeenCalled()
  })

  it('reports notification saves separately from preference saves', async () => {
    const { wrapper } = mountSetting()

    await wrapper.findAll('input[type="checkbox"]')[2].setValue(false)

    expect(elementMocks.success).toHaveBeenCalledTimes(1)
    expect(elementMocks.success).toHaveBeenCalledWith('通知设置已保存')
    expect(elementMocks.error).not.toHaveBeenCalled()
  })

  it('restores notification settings when server save fails', async () => {
    const { wrapper } = mountSetting()
    await flushPromises()
    saveNotificationPreferencesMock.mockRejectedValueOnce(new Error('server failed'))

    const emotionReminderInput = wrapper.findAll('input[type="checkbox"]')[2]
    await emotionReminderInput.setValue(false)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect((wrapper.findAll('input[type="checkbox"]')[2].element as HTMLInputElement).checked).toBe(
      true
    )
    expect(elementMocks.error).toHaveBeenCalledTimes(1)
    expect(elementMocks.error).toHaveBeenCalledWith('通知设置保存失败，已恢复原值')
    expect(elementMocks.success).not.toHaveBeenCalled()
  })

  it('sends a real test notification through the server', async () => {
    const { wrapper } = mountSetting()
    await flushPromises()

    await wrapper.find('[data-test="send-test-notification"]').trigger('click')
    await flushPromises()

    expect(createTestNotificationMock).toHaveBeenCalledTimes(1)
    expect(elementMocks.success).toHaveBeenCalledWith('提醒测试成功：这是由服务端生成的真实站内提醒。')
  })

  it('deletes the account through the API, then clears login state and redirects', async () => {
    let resolveDelete!: (value: null) => void
    deleteCurrentAccountMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      })
    )
    const { wrapper, store } = mountSetting()

    await wrapper.find('.setting-item.danger .danger-btn').trigger('click')
    const confirmButton = wrapper.find('.modal-footer .confirm-btn.danger-btn')
    await confirmButton.trigger('click')
    await confirmButton.trigger('click')
    await flushPromises()

    expect(deleteCurrentAccountMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.modal-footer .confirm-btn.danger-btn').attributes('disabled')).toBeDefined()

    resolveDelete(null)
    await flushPromises()

    expect(store.token).toBe('')
    expect(store.user).toBeNull()
    // A2-02: token 不再存储在 localStorage
    expect(elementMocks.success).toHaveBeenCalledWith('账号已注销')
    expect(routerMocks.push).toHaveBeenCalledWith('/login')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('keeps the session and confirmation modal when account deletion fails', async () => {
    deleteCurrentAccountMock.mockRejectedValueOnce(new Error('server failed'))
    const { wrapper, store } = mountSetting()

    await wrapper.find('.setting-item.danger .danger-btn').trigger('click')
    await wrapper.find('.modal-footer .confirm-btn.danger-btn').trigger('click')
    await flushPromises()

    expect(store.token).toBe('jwt-token')
    expect(store.user?.username).toBe('student_demo')
    // A2-02: token 不再存储在 localStorage
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(elementMocks.error).toHaveBeenCalled()
    expect(routerMocks.push).not.toHaveBeenCalled()
  })
})
