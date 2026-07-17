/**
 * AI 上下文聚合服务测试
 */

import { buildAiContext, buildContextPrompt } from '../../../src/services/aiContextService'

jest.mock('../../../src/config/mysql', () => ({
  getMysqlPool: jest.fn(() => ({
    query: jest.fn(),
    getConnection: jest.fn(),
  })),
}))

describe('aiContextService', () => {
  describe('buildContextPrompt', () => {
    it('有历史数据时返回完整上下文', () => {
      const context = {
        recentMoods: [
          {
            id: 1,
            date: '2026-07-17',
            emotions: ['开心', '平静'],
            intensity: 7.5,
            description: null,
            trigger: '完成了一个项目',
          },
          {
            id: 2,
            date: '2026-07-16',
            emotions: ['焦虑'],
            intensity: 5.0,
            description: null,
            trigger: '考试压力',
          },
        ],
        latestAssessment: {
          id: 1,
          instrumentName: 'PHQ-9',
          score: 12,
          riskLevel: 'normal',
          submittedAt: '2026-07-15T10:00:00.000Z',
        },
        summary: {
          totalMoodRecords: 2,
          dateRange: '2026-07-10 ~ 2026-07-17',
          hasAssessment: true,
        },
      }

      const prompt = buildContextPrompt(context)
      expect(prompt).toContain('近 7 天')
      expect(prompt).toContain('2 次情绪')
      expect(prompt).toContain('开心')
      expect(prompt).toContain('焦虑')
      expect(prompt).toContain('PHQ-9')
      expect(prompt).toContain('12')
    })

    it('无历史数据时返回空上下文提示', () => {
      const context = {
        recentMoods: [],
        latestAssessment: null,
        summary: {
          totalMoodRecords: 0,
          dateRange: '2026-07-10 ~ 2026-07-17',
          hasAssessment: false,
        },
      }

      const prompt = buildContextPrompt(context)
      expect(prompt).toContain('无情绪记录')
      expect(prompt).not.toContain('PHQ-9')
    })

    it('只有情绪记录无测评时正常返回', () => {
      const context = {
        recentMoods: [
          {
            id: 1,
            date: '2026-07-17',
            emotions: ['平静'],
            intensity: 5.0,
            description: null,
            trigger: null,
          },
        ],
        latestAssessment: null,
        summary: {
          totalMoodRecords: 1,
          dateRange: '2026-07-10 ~ 2026-07-17',
          hasAssessment: false,
        },
      }

      const prompt = buildContextPrompt(context)
      expect(prompt).toContain('1 次情绪')
      expect(prompt).not.toContain('测评')
    })

    it('只有测评无情绪记录时正常返回', () => {
      const context = {
        recentMoods: [],
        latestAssessment: {
          id: 1,
          instrumentName: 'GAD-7',
          score: 8,
          riskLevel: 'normal',
          submittedAt: '2026-07-15T10:00:00.000Z',
        },
        summary: {
          totalMoodRecords: 0,
          dateRange: '2026-07-10 ~ 2026-07-17',
          hasAssessment: true,
        },
      }

      const prompt = buildContextPrompt(context)
      expect(prompt).toContain('无情绪记录')
      expect(prompt).toContain('GAD-7')
    })
  })
})