import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CounselingHistorySidebar from '@/components/counseling/CounselingHistorySidebar.vue'
import type { SessionItem } from '@/api/counseling'

const sessions: SessionItem[] = [
  {
    sessionId: 's1',
    title: '睡眠调整计划',
    createdAt: '2026-08-02T08:00:00.000Z',
    lastMessageAt: '2026-08-02T09:00:00.000Z',
    messageCount: 2,
  },
]

const mountSidebar = (props: Partial<{
  sessions: SessionItem[]
  currentSessionId: string
  loading: boolean
  error: string
}> = {}) => mount(CounselingHistorySidebar, {
  props: {
    sessions,
    currentSessionId: '',
    loading: false,
    error: '',
    ...props,
  },
})

describe('CounselingHistorySidebar', () => {
  it('renders titles and marks the current session', () => {
    const wrapper = mountSidebar({ currentSessionId: 's1' })

    expect(wrapper.get('[data-session-id="s1"]').classes()).toContain('active')
    expect(wrapper.text()).toContain('睡眠调整计划')
    expect(wrapper.text()).toContain('2 条消息')
  })

  it('emits select when a history row is clicked', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[data-session-id="s1"]').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual(['s1'])
  })

  it('emits a trimmed rename on Enter', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[aria-label="会话操作"]').trigger('click')
    await wrapper.get('[data-action="rename"]').trigger('click')
    await wrapper.get('input').setValue('  新标题  ')
    await wrapper.get('input').trigger('keydown.enter')

    expect(wrapper.emitted('rename')?.[0]).toEqual([{
      sessionId: 's1',
      title: '新标题',
    }])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows validation and does not emit an invalid title', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[aria-label="会话操作"]').trigger('click')
    await wrapper.get('[data-action="rename"]').trigger('click')
    await wrapper.get('input').setValue('   ')
    await wrapper.get('input').trigger('keydown.enter')

    expect(wrapper.text()).toContain('标题长度为1到30个字符')
    expect(wrapper.emitted('rename')).toBeUndefined()
  })

  it('shows retry for load failures', async () => {
    const wrapper = mountSidebar({ sessions: [], error: '历史会话加载失败，请重试' })

    expect(wrapper.text()).toContain('历史会话加载失败，请重试')
    await wrapper.get('[data-action="retry"]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('cancels rename on Escape without emitting', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[aria-label="会话操作"]').trigger('click')
    await wrapper.get('[data-action="rename"]').trigger('click')
    await wrapper.get('input').setValue('不会保存')
    await wrapper.get('input').trigger('keydown.esc')

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted('rename')).toBeUndefined()
  })
})
