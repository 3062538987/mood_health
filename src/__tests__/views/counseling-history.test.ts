import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Counseling from '@/views/counseling/Counseling.vue'
import {
  getSessions,
  loadSessionMessages,
  renameSession,
} from '@/api/counseling'
import { ElMessage } from 'element-plus'

vi.mock('@/api/counseling', () => ({
  getSessions: vi.fn(),
  loadSessionMessages: vi.fn(),
  renameSession: vi.fn(),
  sendSessionCounselingMessage: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(),
  },
}))

const getSessionsMock = vi.mocked(getSessions)
const loadSessionMessagesMock = vi.mocked(loadSessionMessages)
const renameSessionMock = vi.mocked(renameSession)
const messageErrorMock = vi.mocked(ElMessage.error)
const messageSuccessMock = vi.mocked(ElMessage.success)

const session = {
  sessionId: 's1',
  title: '睡眠调整计划',
  createdAt: '2026-08-02T08:00:00.000Z',
  lastMessageAt: '2026-08-02T09:00:00.000Z',
  messageCount: 2,
}

const mountCounseling = () => mount(Counseling, {
  global: {
    stubs: {
      ElInput: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<textarea :value="modelValue" />',
      },
      ElButton: {
        props: ['disabled', 'loading'],
        emits: ['click'],
        template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
      },
    },
  },
})

describe('Counseling history flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getSessionsMock.mockReset().mockResolvedValue([])
    loadSessionMessagesMock.mockReset().mockResolvedValue([])
    renameSessionMock.mockReset()
    messageErrorMock.mockReset()
    messageSuccessMock.mockReset()
  })

  it('renders the already-unwrapped history response', async () => {
    getSessionsMock.mockResolvedValueOnce([session])
    const wrapper = mountCounseling()

    await flushPromises()
    await wrapper.get('.sidebar-toggle').trigger('click')

    expect(wrapper.text()).toContain(session.title)
  })

  it('loads the already-unwrapped message array when a session is selected', async () => {
    getSessionsMock.mockResolvedValueOnce([session])
    loadSessionMessagesMock.mockResolvedValueOnce([
      { role: 'user', content: '最近睡不好', createdAt: '2026-08-02T08:00:00.000Z' },
      {
        role: 'assistant',
        content: '我在听。',
        createdAt: '2026-08-02T08:00:01.000Z',
        sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
      },
    ])
    const wrapper = mountCounseling()

    await flushPromises()
    await wrapper.get('.sidebar-toggle').trigger('click')
    await wrapper.get('[data-session-id="s1"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('最近睡不好')
    expect(wrapper.text()).toContain('我在听。')
    expect(wrapper.get('[aria-label="参考来源"]').text()).toContain('国家卫健委')
  })

  it('updates the local title after a successful rename', async () => {
    getSessionsMock.mockResolvedValueOnce([session])
    renameSessionMock.mockResolvedValueOnce({ sessionId: 's1', title: '新的睡眠计划' })
    const wrapper = mountCounseling()

    await flushPromises()
    await wrapper.get('.sidebar-toggle').trigger('click')
    await wrapper.get('[aria-label="会话操作"]').trigger('click')
    await wrapper.get('[data-action="rename"]').trigger('click')
    await wrapper.get('input').setValue('新的睡眠计划')
    await wrapper.get('input').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('新的睡眠计划')
    expect(messageSuccessMock).toHaveBeenCalledWith('会话已重命名')
  })

  it('keeps the old title and reports a rename failure', async () => {
    getSessionsMock.mockResolvedValueOnce([session])
    renameSessionMock.mockRejectedValueOnce(new Error('网络异常'))
    const wrapper = mountCounseling()

    await flushPromises()
    await wrapper.get('.sidebar-toggle').trigger('click')
    await wrapper.get('[aria-label="会话操作"]').trigger('click')
    await wrapper.get('[data-action="rename"]').trigger('click')
    await wrapper.get('input').setValue('新标题')
    await wrapper.get('input').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain(session.title)
    expect(wrapper.text()).not.toContain('新标题')
    expect(messageErrorMock).toHaveBeenCalledWith('网络异常')
  })

  it('shows a load failure and retries', async () => {
    getSessionsMock
      .mockRejectedValueOnce(new Error('网络异常'))
      .mockResolvedValueOnce([session])
    const wrapper = mountCounseling()

    await flushPromises()
    await wrapper.get('.sidebar-toggle').trigger('click')
    expect(wrapper.text()).toContain('历史会话加载失败，请重试')

    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(session.title)
  })
})
