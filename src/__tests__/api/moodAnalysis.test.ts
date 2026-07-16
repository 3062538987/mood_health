import { describe, expect, it } from 'vitest'
import { analyzeMood } from '@/api/moodAnalysis'

describe('R0 mood analysis boundary', () => {
  it('rejects empty mood text before any analysis request', async () => {
    await expect(analyzeMood({ content: '', mood_level: 5 })).rejects.toThrow('情绪描述不能为空')
  })

  it('rejects an invalid self-reported intensity', async () => {
    await expect(analyzeMood({ content: '测试内容', mood_level: 11 })).rejects.toThrow(
      '情绪强度必须在1-10之间'
    )
  })

  it('does not infer a psychological label from keywords during R0', async () => {
    await expect(analyzeMood({ content: '我今天感到很兴奋', mood_level: 7 })).rejects.toThrow(
      'AI 情绪分析将在 v1.1 启用'
    )
  })
})
