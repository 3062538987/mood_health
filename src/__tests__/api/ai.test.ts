import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { getInterpretation, getMoodReport } from '@/api/ai'
import type { InterpretationInput, InterpretationResult, MoodReportInput, MoodReportResult } from '@/api/ai'

const requestMock = vi.mocked(request)

describe('AI 量表解读功能', () => {
  const validInput: InterpretationInput = {
    scaleName: 'SDS 抑郁自评量表',
    scaleType: 'depression',
    totalScore: 58,
    maxScore: 80,
    itemScores: [
      { label: '情绪低落', score: 3 },
      { label: '睡眠障碍', score: 2 },
      { label: '食欲减退', score: 4 },
    ],
    riskLevel: 'medium',
  }

  it('成功返回量表解读结果', async () => {
    requestMock.mockResolvedValueOnce({
      content: '根据SDS量表得分(58/80)，您的抑郁程度为中度...',
      generatedAt: '2026-01-01T00:00:00Z',
    } satisfies InterpretationResult)

    const result = await getInterpretation(validInput)

    expect(result.content).toContain('SDS')
    expect(result.generatedAt).toBeDefined()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/interpret',
      method: 'post',
      data: validInput,
    })
  })

  it('正确处理空量表名称', async () => {
    requestMock.mockResolvedValueOnce({
      content: '无法识别量表类型',
      generatedAt: '2026-01-01T00:00:00Z',
    })

    const result = await getInterpretation({ ...validInput, scaleName: '' })

    expect(result.content).toBeDefined()
    expect(requestMock).toHaveBeenCalled()
  })

  it('正确传递 API 参数', async () => {
    requestMock.mockResolvedValueOnce({ content: 'ok', generatedAt: '2026-01-01T00:00:00Z' })

    await getInterpretation(validInput)

    const callArgs = requestMock.mock.calls[0][0]
    expect(callArgs.url).toBe('/api/ai/interpret')
    expect(callArgs.method).toBe('post')
    expect(callArgs.data).toEqual(validInput)
  })
})

describe('AI 情绪报告生成', () => {
  const validReportInput: MoodReportInput = {
    userName: '测试用户',
    dateRange: '2026-01-01 至 2026-01-07',
    recordCount: 7,
    primaryEmotions: '开心, 平静',
    averageIntensity: 6.5,
    mostFrequentMood: '开心',
    trend: '情绪呈上升趋势',
    highlights: '周一最开心',
    lowPoints: '周三有些低落',
    emotionDistribution: '开心:40%, 平静:30%, 焦虑:20%, 难过:10%',
    type: 'weekly',
  }

  it('成功生成周报', async () => {
    requestMock.mockResolvedValueOnce({
      content: '本周情绪报告：总体积极向好...',
      generatedAt: '2026-01-07T00:00:00Z',
    } satisfies MoodReportResult)

    const result = await getMoodReport(validReportInput)

    expect(result.content).toBeDefined()
    expect(result.generatedAt).toBeDefined()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/report',
      method: 'post',
      data: validReportInput,
    })
  })

  it('成功生成月报', async () => {
    const monthlyInput: MoodReportInput = {
      ...validReportInput,
      type: 'monthly',
      dateRange: '2026-01-01 至 2026-01-31',
      recordCount: 30,
    }

    requestMock.mockResolvedValueOnce({
      content: '月度情绪报告：本月情绪波动...',
      generatedAt: '2026-01-31T00:00:00Z',
    } satisfies MoodReportResult)

    const result = await getMoodReport(monthlyInput)

    expect(result.content).toBeDefined()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/report',
      method: 'post',
      data: monthlyInput,
    })
  })

  it('正确传递 API 参数', async () => {
    requestMock.mockResolvedValueOnce({ content: 'ok', generatedAt: '2026-01-01T00:00:00Z' })

    await getMoodReport(validReportInput)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/report',
      method: 'post',
      data: expect.objectContaining({ type: 'weekly' }),
    })
  })
})