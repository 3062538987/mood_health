import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Cases from '@/views/admin/Cases.vue'
import { getMyCases } from '@/api/case'

vi.mock('@/api/case', () => ({ getMyCases: vi.fn() }))
const casesMock = vi.mocked(getMyCases)

describe('Admin risk cases', () => {
  beforeEach(() => {
    casesMock.mockReset().mockResolvedValue([
      {
        id: 1,
        studentUserId: 7,
        assignedCounselorId: null,
        sourceSessionId: null,
        origin: 'automatic_risk',
        status: 'open',
        riskLevel: 'high',
        summary: '自动风险规则命中',
        triggerReasons: ['连续7天情绪记录评分低于5分', 'AI问答出现高风险内容'],
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ])
  })

  it('shows the real OR conditions that triggered each automatic case', async () => {
    const wrapper = mount(Cases, { global: { stubs: { RouterLink: true } } })
    await flushPromises()

    expect(wrapper.text()).toContain('触发原因（满足任一即可）')
    expect(wrapper.text()).toContain('连续7天情绪记录评分低于5分')
    expect(wrapper.text()).toContain('AI问答出现高风险内容')
  })
})
