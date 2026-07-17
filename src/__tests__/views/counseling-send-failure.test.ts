import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Counseling from '@/views/counseling/Counseling.vue'
import { sendCounselingMessage } from '@/api/counseling'
import { ElMessage } from 'element-plus'

vi.mock('@/api/counseling', () => ({
  sendCounselingMessage: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

const sendCounselingMessageMock = vi.mocked(sendCounselingMessage)
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
    sendCounselingMessageMock.mockReset()
    messageErrorMock.mockReset()
  })

  it('shows a persistent input-level alert and keeps the original text after send failure', async () => {
    sendCounselingMessageMock.mockRejectedValueOnce(new Error('网络异常'))
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
    sendCounselingMessageMock
      .mockRejectedValueOnce(new Error('网络异常'))
      .mockResolvedValueOnce({
        response: '我在听，我们可以先把压力拆小一点。',
        riskLevel: 'low',
        hasRiskContent: false,
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
})
