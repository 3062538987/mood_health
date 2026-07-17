import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Questionnaire from '@/views/improve/Questionnaire.vue'
import {
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
} from '@/api/questionnaire'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('@/api/questionnaire', () => ({
  getQuestionnaireDetail: vi.fn(),
  getQuestionnaireQuestions: vi.fn(),
  submitAssessment: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
  useRoute: () => ({ params: { id: '1' } }),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

const getQuestionnaireDetailMock = vi.mocked(getQuestionnaireDetail)
const getQuestionnaireQuestionsMock = vi.mocked(getQuestionnaireQuestions)
const submitAssessmentMock = vi.mocked(submitAssessment)

const questions = [
  {
    id: 11,
    questionnaire_id: 1,
    question_text: '第一题',
    question_type: 'single',
    options: ['A', 'B'],
    sort_order: 1,
    is_reverse: false,
  },
  {
    id: 12,
    questionnaire_id: 1,
    question_text: '第二题',
    question_type: 'single',
    options: ['C', 'D'],
    sort_order: 2,
    is_reverse: false,
  },
]

const mountQuestionnaire = async () => {
  getQuestionnaireDetailMock.mockResolvedValue({
    id: 1,
    title: '压力筛查',
    description: '测试描述',
    type: 'stress',
    created_at: '2026-01-01T00:00:00.000Z',
  })
  getQuestionnaireQuestionsMock.mockResolvedValue(questions)

  const wrapper = mount(Questionnaire)
  await flushPromises()
  return wrapper
}

describe('Questionnaire submit failure recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps answers and the current question after submit failure without writing localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    submitAssessmentMock.mockRejectedValueOnce({ response: { data: { code: 'FEATURE_DISABLED' } } })
    const wrapper = await mountQuestionnaire()

    await wrapper.findAll('.option-item')[1].trigger('click')
    await wrapper.find('.navigation-buttons .btn.primary').trigger('click')
    await wrapper.findAll('.option-item')[0].trigger('click')
    await wrapper.find('.navigation-buttons .btn.primary').trigger('click')
    await flushPromises()

    expect(submitAssessmentMock).toHaveBeenCalledWith({
      questionnaire_id: 1,
      answers: [{ itemId: 11, score: 1 }, { itemId: 12, score: 0 }],
    })
    expect(wrapper.find('[role="alert"]').text()).toContain('提交失败')
    expect(wrapper.find('.progress-text').text()).toBe('2 / 2')
    expect(wrapper.findAll('.option-item')[0].classes()).toContain('active')

    await wrapper.find('.navigation-buttons .btn.secondary').trigger('click')
    expect(wrapper.find('.progress-text').text()).toBe('1 / 2')
    expect(wrapper.findAll('.option-item')[1].classes()).toContain('active')
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('prevents duplicate submit requests while a submission is pending', async () => {
    let rejectSubmit!: (reason: Error) => void
    submitAssessmentMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSubmit = reject
      })
    )
    const wrapper = await mountQuestionnaire()

    await wrapper.findAll('.option-item')[0].trigger('click')
    await wrapper.find('.navigation-buttons .btn.primary').trigger('click')
    await wrapper.findAll('.option-item')[0].trigger('click')
    const submitButton = wrapper.find('.navigation-buttons .btn.primary')
    await submitButton.trigger('click')
    await submitButton.trigger('click')
    await flushPromises()

    expect(submitAssessmentMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.navigation-buttons .btn.primary').attributes('disabled')).toBeDefined()

    rejectSubmit(new Error('FEATURE_DISABLED'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('提交失败')
  })
})
