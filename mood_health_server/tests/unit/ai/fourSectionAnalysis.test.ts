/**
 * 四段式结构化分析测试
 */

import { parseFourSection, SAFE_FALLBACK_ANALYSIS, FourSectionAnalysis } from '../../../src/utils/ai/moodAnalysisService'

jest.mock('../../../src/utils/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}))

describe('parseFourSection', () => {
  it('正常解析四段式 JSON', () => {
    const raw = JSON.stringify({
      summary: '您最近情绪波动较大，整体偏向焦虑。',
      possibleCauses: '可能与工作压力增加和睡眠不足有关。',
      todayActions: ['进行15分钟深呼吸练习', '写下今天的三件好事', '晚上10点前放下手机'],
      whenToSeekHelp: '如果焦虑持续超过两周，建议咨询心理医生。',
    })

    const result = parseFourSection(raw)
    expect(result.summary).toContain('情绪波动')
    expect(result.possibleCauses).toContain('工作压力')
    expect(result.todayActions).toHaveLength(3)
    expect(result.todayActions[0]).toContain('深呼吸')
    expect(result.whenToSeekHelp).toContain('心理医生')
  })

  it('JSON 中包含 markdown 代码块标记时仍能解析', () => {
    const raw = '```json\n' + JSON.stringify({
      summary: '测试',
      possibleCauses: '测试原因',
      todayActions: ['行动1'],
      whenToSeekHelp: '测试提示',
    }) + '\n```'

    const result = parseFourSection(raw)
    expect(result.summary).toBe('测试')
    expect(result.todayActions).toHaveLength(1)
  })

  it('非法 JSON 返回安全兜底', () => {
    const result = parseFourSection('这不是 JSON')
    expect(result).toEqual(SAFE_FALLBACK_ANALYSIS)
  })

  it('空字符串返回安全兜底', () => {
    const result = parseFourSection('')
    expect(result).toEqual(SAFE_FALLBACK_ANALYSIS)
  })

  it('JSON 字段缺失时使用默认值', () => {
    const result = parseFourSection(JSON.stringify({ summary: '部分数据' }))
    expect(result.summary).toBe('部分数据')
    expect(result.possibleCauses).toBe(SAFE_FALLBACK_ANALYSIS.possibleCauses)
    expect(result.todayActions).toEqual(SAFE_FALLBACK_ANALYSIS.todayActions)
    expect(result.whenToSeekHelp).toBe(SAFE_FALLBACK_ANALYSIS.whenToSeekHelp)
  })

  it('todayActions 为空数组时使用兜底', () => {
    const result = parseFourSection(JSON.stringify({
      summary: '测试',
      possibleCauses: '测试',
      todayActions: [],
      whenToSeekHelp: '测试',
    }))
    expect(result.todayActions).toEqual(SAFE_FALLBACK_ANALYSIS.todayActions)
  })

  it('todayActions 包含非字符串时过滤', () => {
    const result = parseFourSection(JSON.stringify({
      summary: '测试',
      possibleCauses: '测试',
      todayActions: ['有效', 123, null, '也有效'],
      whenToSeekHelp: '测试',
    }))
    expect(result.todayActions).toHaveLength(2)
    expect(result.todayActions[0]).toBe('有效')
    expect(result.todayActions[1]).toBe('也有效')
  })
})
