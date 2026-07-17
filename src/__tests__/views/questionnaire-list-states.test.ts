import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionnaireList from '@/views/improve/QuestionnaireList.vue'
import { getAssessmentHistory, getQuestionnaires } from '@/api/questionnaire'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('@/api/questionnaire', () => ({
  getAssessmentHistory: vi.fn(),
  getQuestionnaires: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
}))

const getQuestionnairesMock = vi.mocked(getQuestionnaires)
const getAssessmentHistoryMock = vi.mocked(getAssessmentHistory)

const questionnaires = [
  {
    id: 1,
    title: '压力筛查',
    description: '了解最近的压力状态',
    type: 'stress',
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

const mountList = () =>
  mount(QuestionnaireList, {
    global: {
      stubs: {
        SoftLoadingState: {
          props: ['title', 'description'],
          template: '<section class="soft-loading-state">{{ title }} {{ description }}</section>',
        },
        SoftEmptyState: {
          props: ['title', 'description', 'actionText'],
          emits: ['action'],
          template:
            '<section class="soft-empty-state"><h3>{{ title }}</h3><p>{{ description }}</p><button @click="$emit(\'action\')">{{ actionText }}</button></section>',
        },
      },
    },
  })

describe('QuestionnaireList states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a readable page loading state while list and history requests are pending', async () => {
    getQuestionnairesMock.mockReturnValue(new Promise(() => {}))
    getAssessmentHistoryMock.mockReturnValue(new Promise(() => {}))

    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.find('.soft-loading-state').text()).toContain('正在加载问卷')
    expect(wrapper.find('.questionnaire-card').exists()).toBe(false)
  })

  it('shows a blocking error and retry action when the questionnaire list fails', async () => {
    getQuestionnairesMock.mockRejectedValueOnce(new Error('list failed')).mockResolvedValueOnce(questionnaires)
    getAssessmentHistoryMock.mockResolvedValue([])
    const wrapper = mountList()
    await flushPromises()

    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('问卷列表加载失败')
    expect(wrapper.find('.questionnaire-card').exists()).toBe(false)

    await wrapper.find('.retry-btn').trigger('click')
    await flushPromises()

    expect(getQuestionnairesMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.questionnaire-card').text()).toContain('压力筛查')
  })

  it('keeps the questionnaire list available when only history loading fails', async () => {
    getQuestionnairesMock.mockResolvedValue(questionnaires)
    getAssessmentHistoryMock.mockRejectedValue(new Error('history failed'))
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.find('.questionnaire-card').text()).toContain('压力筛查')
    expect(wrapper.find('[role="status"]').text()).toContain('历史记录暂时无法加载')
  })

  it('shows a soft empty state when the questionnaire list is empty', async () => {
    getQuestionnairesMock.mockResolvedValue([])
    getAssessmentHistoryMock.mockResolvedValue([])
    const wrapper = mountList()
    await flushPromises()

    expect(wrapper.find('.soft-empty-state').text()).toContain('暂无可用问卷')
    expect(wrapper.find('.questionnaire-card').exists()).toBe(false)
  })
})
