import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KnowledgeAssistant from '@/views/ai/KnowledgeAssistant.vue'
import {
  getKnowledgeSessions,
  loadKnowledgeMessages,
  sendKnowledgeMessage,
} from '@/api/knowledgeAssistant'

vi.mock('@/api/knowledgeAssistant', () => ({
  getKnowledgeSessions: vi.fn(),
  loadKnowledgeMessages: vi.fn(),
  sendKnowledgeMessage: vi.fn(),
}))

const getSessionsMock = vi.mocked(getKnowledgeSessions)
const loadMessagesMock = vi.mocked(loadKnowledgeMessages)
const sendMessageMock = vi.mocked(sendKnowledgeMessage)

describe('knowledge assistant page', () => {
  beforeEach(() => {
    getSessionsMock.mockReset().mockResolvedValue([])
    loadMessagesMock.mockReset().mockResolvedValue([])
    sendMessageMock.mockReset()
  })

  it('renders the answer and server-provided sources after sending', async () => {
    sendMessageMock.mockResolvedValue({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      answer: '保持规律作息。',
      sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
      requestId: 'r1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      fallbackUsed: false,
    })
    const wrapper = mount(KnowledgeAssistant)
    await flushPromises()

    await wrapper.get('textarea').setValue('怎样改善睡眠？')
    await wrapper.get('[data-test="send"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('保持规律作息')
    expect(wrapper.text()).toContain('睡眠卫生')
    expect(wrapper.text()).toContain('国家卫健委')
  })

  it('keeps the failed question and offers retry', async () => {
    sendMessageMock.mockRejectedValue(new Error('知识助手暂时不可用'))
    const wrapper = mount(KnowledgeAssistant)
    await flushPromises()

    await wrapper.get('textarea').setValue('怎样改善睡眠？')
    await wrapper.get('[data-test="send"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('怎样改善睡眠？')
    expect(wrapper.find('[data-test="retry"]').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('知识助手暂时不可用')
  })

  it('loads a selected session with its cited messages', async () => {
    getSessionsMock.mockResolvedValue([
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        title: '睡眠改善',
        lastMessageAt: '2026-08-02T09:00:00.000Z',
        messageCount: 2,
      },
    ])
    loadMessagesMock.mockResolvedValue([
      { role: 'user', content: '睡不着怎么办', sources: [], createdAt: '2026-08-02T08:00:00.000Z' },
      {
        role: 'assistant',
        content: '先建立固定作息。',
        sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
        createdAt: '2026-08-02T08:00:01.000Z',
      },
    ])
    const wrapper = mount(KnowledgeAssistant)
    await flushPromises()

    await wrapper.get('[data-session-id="550e8400-e29b-41d4-a716-446655440000"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('先建立固定作息')
    expect(wrapper.text()).toContain('国家卫健委')
  })
})
