// 验证 context/analyze 响应的 suggestions 兜底：AI 不返回 suggestions 时
// 退化为单条 suggestion（与 moodAnalysisService 真实行为一致），绝不返回
// undefined；两个来源都为空时退化为 []。
jest.mock('../../../src/utils/ai/moodAnalysisService', () => ({
  __esModule: true,
  default: {
    analyzeMood: jest.fn(),
    analyzeWithFourSection: jest.fn(),
  },
}))

jest.mock('../../../src/services/aiContextService', () => ({
  buildAiContext: jest.fn(),
  buildContextPrompt: jest.fn().mockReturnValue('上下文文本'),
}))

import { Response } from 'express'
import { analyzeWithContext } from '../../../src/controllers/aiContextController'
import moodAnalysisService from '../../../src/utils/ai/moodAnalysisService'
import { buildAiContext } from '../../../src/services/aiContextService'

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('aiContextController.analyzeWithContext — suggestions 兜底', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 默认：构造一个非空上下文（走 contextPrompt 分支），四段式正常返回
    ;(buildAiContext as jest.Mock).mockResolvedValue({
      summary: { totalMoodRecords: 1, dateRange: '2026-08-01 ~ 2026-08-09', hasAssessment: false },
      recentMoods: [],
      latestAssessment: null,
    })
    ;(moodAnalysisService.analyzeWithFourSection as jest.Mock).mockResolvedValue({
      summary: 's',
      possibleCauses: 'p',
      todayActions: ['a'],
      whenToSeekHelp: 'h',
    })
  })

  const run = async (analyzeMoodResult: Record<string, unknown>) => {
    ;(moodAnalysisService.analyzeMood as jest.Mock).mockResolvedValue(analyzeMoodResult)
    const response = createResponse()
    await analyzeWithContext(
      {
        user: { userId: 2, username: 'student_demo', role: 'student' },
        body: { message: '今天有点焦虑', mood: 4 },
      } as never,
      response,
    )
    const payload = (response.json as jest.Mock).mock.calls[0][0]
    return { payload, response }
  }

  it('AI 返回真实 suggestions 时原样返回', async () => {
    const { payload } = await run({
      analysis: '分析文本',
      suggestions: ['建议A', '建议B'],
      suggestion: '建议A；建议B',
      mood: '焦虑',
      mood_score: 4,
      risk_level: 'low',
      confidence: 0.8,
      emotions: [],
    })
    expect(payload.code).toBe(0)
    expect(payload.data.suggestions).toEqual(['建议A', '建议B'])
  })

  it('AI 不返回 suggestions（与 moodAnalysisService 真实行为一致）时退化为单条 suggestion', async () => {
    // moodAnalysisService 在 AI 缺失 suggestions 时：suggestions=[]，suggestion='保持积极心态'
    const { payload } = await run({
      analysis: '分析文本',
      suggestions: [],
      suggestion: '保持积极心态',
      mood: '焦虑',
      mood_score: 4,
      risk_level: 'low',
      confidence: 0.8,
      emotions: [],
    })
    expect(payload.code).toBe(0)
    expect(payload.data.suggestions).toEqual(['保持积极心态'])
  })

  it('两个来源都为空时退化为 []（绝不 undefined）', async () => {
    const { payload } = await run({
      analysis: '分析文本',
      suggestions: [],
      suggestion: '',
      mood: '未知',
      mood_score: 5,
      risk_level: 'low',
      confidence: 0.8,
      emotions: [],
    })
    expect(payload.code).toBe(0)
    expect(Array.isArray(payload.data.suggestions)).toBe(true)
    expect(payload.data.suggestions).toEqual([])
  })
})
