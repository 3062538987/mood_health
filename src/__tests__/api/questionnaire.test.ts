import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import {
  getAssessmentHistory,
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  getQuestionnaires,
  submitAssessment,
} from '@/api/questionnaire'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

const requestMock = vi.mocked(request)

describe('questionnaire API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('returns unwrapped list, detail and question DTOs', async () => {
    const questionnaire = {
      id: 1,
      title: '情绪状态自评',
      description: '用于自我筛查',
      type: 'SDS',
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const questions = [
      {
        id: 1,
        questionnaire_id: 1,
        question_text: '示例问题',
        question_type: 'single',
        options: ['从不', '偶尔', '经常', '总是'],
        sort_order: 1,
        is_reverse: false,
      },
    ]
    requestMock
      .mockResolvedValueOnce([questionnaire])
      .mockResolvedValueOnce(questionnaire)
      .mockResolvedValueOnce(questions)

    await expect(getQuestionnaires()).resolves.toEqual([questionnaire])
    await expect(getQuestionnaireDetail(1)).resolves.toEqual(questionnaire)
    await expect(getQuestionnaireQuestions(1)).resolves.toEqual(questions)
  })

  it('returns a structured screening result directly', async () => {
    const screeningResult = {
      score: 40,
      result_text: '筛查提示：当前得分处于较低风险区间。',
      screening_type: 'SDS',
      risk_level: 'low',
      disclaimer: '本结果仅用于自我筛查与风险提示，不构成医学诊断。',
    }
    requestMock.mockResolvedValueOnce(screeningResult)

    await expect(submitAssessment({ questionnaire_id: 1, answers: [{ itemId: 1, score: 0 }] })).resolves.toEqual(
      screeningResult
    )
  })

  it('returns the unwrapped assessment history', async () => {
    const history = [
      {
        id: 1,
        user_id: 1,
        questionnaire_id: 1,
        score: 40,
        result_text: '筛查提示：当前得分处于较低风险区间。',
        created_at: '2026-01-01T00:00:00.000Z',
        title: '情绪状态自评',
        type: 'SDS',
      },
    ]
    requestMock.mockResolvedValueOnce(history)

    await expect(getAssessmentHistory()).resolves.toEqual(history)
  })
})
