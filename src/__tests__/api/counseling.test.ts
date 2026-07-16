import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Vitest 全局类型声明
declare global {
  const vi: any
}
import {
  sendCounselingMessage,
  sendCounselingMessageWithContext,
  validateCounselingRequest,
  formatMessagesToContext,
} from '@/api/counseling'

describe('心理咨询API测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendCounselingMessage', () => {
    it('应该成功发送心理咨询消息并返回响应', async () => {
      const result = await sendCounselingMessage({
        message: '我最近感到很焦虑，不知道该怎么办',
      })

      expect(result.riskLevel).toBe('low')
      expect(result.mood).toBe('焦虑')
      expect(result.response.length).toBeGreaterThan(0)
    })

    it('应该在消息为空时抛出错误', async () => {
      await expect(sendCounselingMessage({ message: '' })).rejects.toThrow('消息内容不能为空')
      await expect(sendCounselingMessage({ message: '   ' })).rejects.toThrow('消息内容不能为空')
    })

    it('应该在消息过长时抛出错误', async () => {
      const longMessage = 'a'.repeat(1001)
      await expect(sendCounselingMessage({ message: longMessage })).rejects.toThrow(
        '消息内容不能超过1000字'
      )
    })

    it('应对低落情绪给出本地回复', async () => {
      const result = await sendCounselingMessage({
        message: '最近有点难过和低落',
      })

      expect(result.mood).toBe('低落')
      expect(result.riskLevel).toBe('low')
    })

    it('应对一般内容给出平静回复', async () => {
      const result = await sendCounselingMessage({
        message: '我想把今天的安排理清楚',
      })

      expect(result.mood).toBe('平静')
      expect(result.riskLevel).toBe('low')
    })
  })

  describe('sendCounselingMessageWithContext', () => {
    it('应该成功发送带上下文的心理咨询消息', async () => {
      const context: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: '我最近工作压力很大' },
        {
          role: 'assistant',
          content: '工作压力大确实会让人感到疲惫，你能具体说说是什么让你感到压力吗？',
        },
      ]

      const result = await sendCounselingMessageWithContext({
        message: '项目 deadlines 快到了，我担心完成不了',
        context,
      })

      expect(result.riskLevel).toBe('low')
      expect(result.response.length).toBeGreaterThan(0)
    })

    it('应该在上下文为空时抛出错误', async () => {
      await expect(
        sendCounselingMessageWithContext({
          message: '我感到很焦虑',
          context: [],
        })
      ).rejects.toThrow('上下文不能为空')
    })

    it('应该在上下文过长时抛出错误', async () => {
      const longContext: Array<{
        role: 'user' | 'assistant'
        content: string
      }> = Array(11).fill({ role: 'user', content: 'test' })
      await expect(
        sendCounselingMessageWithContext({
          message: '我感到很焦虑',
          context: longContext,
        })
      ).rejects.toThrow('上下文长度不能超过10条消息')
    })
  })

  describe('validateCounselingRequest', () => {
    it('应该验证有效的请求', () => {
      const validRequest: {
        message: string
        context: Array<{ role: 'user' | 'assistant'; content: string }>
      } = {
        message: '我感到很焦虑',
        context: [{ role: 'user', content: '我最近工作压力很大' }],
      }
      expect(validateCounselingRequest(validRequest)).toBe(true)
    })

    it('应该拒绝空消息', () => {
      const invalidRequest = {
        message: '',
        context: [],
      }
      expect(validateCounselingRequest(invalidRequest)).toBe(false)
    })

    it('应该拒绝过长的消息', () => {
      const invalidRequest = {
        message: 'a'.repeat(1001),
        context: [],
      }
      expect(validateCounselingRequest(invalidRequest)).toBe(false)
    })

    it('应该拒绝过长的上下文', () => {
      const invalidRequest = {
        message: '我感到很焦虑',
        context: Array(11).fill({ role: 'user', content: 'test' }) as Array<{
          role: 'user' | 'assistant'
          content: string
        }>,
      }
      expect(validateCounselingRequest(invalidRequest)).toBe(false)
    })
  })

  describe('formatMessagesToContext', () => {
    it('应该正确格式化消息为上下文格式', () => {
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，有什么可以帮助你的吗？' },
        { role: 'user', content: '我感到很焦虑' },
      ]

      const expectedContext = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，有什么可以帮助你的吗？' },
        { role: 'user', content: '我感到很焦虑' },
      ]

      expect(formatMessagesToContext(messages)).toEqual(expectedContext)
    })

    it('应该处理空消息数组', () => {
      expect(formatMessagesToContext([])).toEqual([])
    })
  })
})
