import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Counseling from '@/views/counseling/Counseling.vue'
import { sendSessionCounselingMessage } from '@/api/counseling'
import { ElMessage } from 'element-plus'

vi.mock('@/api/counseling', () => ({
  getSessions: vi.fn().mockResolvedValue([]),
  loadSessionMessages: vi.fn().mockResolvedValue({ messages: [] }),
  renameSession: vi.fn(),
  sendSessionCounselingMessage: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const sendSessionCounselingMessageMock = vi.mocked(sendSessionCounselingMessage)
const messageErrorMock = vi.mocked(ElMessage.error)

const mountCounseling = () =>
  mount(Counseling, {
    global: {
      stubs: {
        ElInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<textarea class="el-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        ElButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template:
            '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })

describe('Counseling send failure feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sendSessionCounselingMessageMock.mockReset()
    messageErrorMock.mockReset()
  })

  it('shows a persistent input-level alert and keeps the original text after send failure', async () => {
    sendSessionCounselingMessageMock.mockRejectedValueOnce(new Error('网络异常'))
    const wrapper = mountCounseling()

    await wrapper.find('textarea').setValue('我今天压力很大')
    await wrapper.find('.send-button').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toContain('发送失败')
    expect(wrapper.find('[role="alert"]').text()).toContain('原文字已保留')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('我今天压力很大')
    expect(wrapper.find('.retry-button').exists()).toBe(true)
    expect(messageErrorMock).toHaveBeenCalledWith('网络异常')
  })

  it('clears the old input-level alert when a new send starts and keeps it cleared on success', async () => {
    sendSessionCounselingMessageMock
      .mockRejectedValueOnce(new Error('网络异常'))
      .mockResolvedValueOnce({
        sessionId: 'test-session',
        response: '我在听，我们可以先把压力拆小一点。',
        riskLevel: 'low',
        hasRiskContent: false,
        sources: [],
        groundingUsed: false,
        requestId: 'r-success',
      })
    const wrapper = mountCounseling()

    await wrapper.find('textarea').setValue('我今天压力很大')
    await wrapper.find('.send-button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await wrapper.find('textarea').setValue('我想重新说一下')
    await wrapper.find('.send-button').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows verified sources only on grounded assistant messages', async () => {
    sendSessionCounselingMessageMock.mockResolvedValueOnce({
      sessionId: 'test-session',
      response: '可以先固定每天的起床时间。',
      riskLevel: 'low',
      hasRiskContent: false,
      sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
      groundingUsed: true,
      requestId: 'r1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      fallbackUsed: false,
    })
    const wrapper = mountCounseling()

    await wrapper.find('textarea').setValue('怎样改善睡眠？')
    await wrapper.find('.send-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[aria-label="参考来源"]').text()).toContain('睡眠卫生')
    expect(wrapper.get('[aria-label="参考来源"]').text()).toContain('国家卫健委')
  })
})
