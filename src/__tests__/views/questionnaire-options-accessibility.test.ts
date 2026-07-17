import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Questionnaire from '@/views/improve/Questionnaire.vue'
import { getQuestionnaireDetail, getQuestionnaireQuestions } from '@/api/questionnaire'

vi.mock('@/api/questionnaire', () => ({
  getQuestionnaireDetail: vi.fn(),
  getQuestionnaireQuestions: vi.fn(),
  submitAssessment: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

describe('Questionnaire answer option accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQuestionnaireDetailMock.mockResolvedValue({
      id: 1,
      title: '压力筛查',
      description: '测试描述',
      type: 'stress',
      created_at: '2026-01-01T00:00:00.000Z',
    })
    getQuestionnaireQuestionsMock.mockResolvedValue([
      {
        id: 11,
        questionnaire_id: 1,
        question_text: '最近是否容易紧张？',
        question_type: 'single',
        options: ['没有', '偶尔', '经常'],
        sort_order: 1,
        is_reverse: false,
      },
    ])
  })

  it('renders answer choices as a native radio group while preserving active visual state', async () => {
    const wrapper = mount(Questionnaire)
    await flushPromises()

    expect(wrapper.find('fieldset.options').exists()).toBe(true)
    expect(wrapper.find('legend').text()).toBe('最近是否容易紧张？')

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(3)
    expect(new Set(radios.map((radio) => radio.attributes('name'))).size).toBe(1)

    await radios[1].setValue(true)
    expect(radios[1].attributes('checked')).toBeDefined()
    expect(wrapper.findAll('.option-item')[1].classes()).toContain('active')
  })
})
