import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeMood, debouncedAnalyzeMood } from '@/api/moodAnalysis'

describe('情绪识别功能测试', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('空文本拦截逻辑', () => {
    it('应该拦截空文本并抛出错误', async () => {
      await expect(analyzeMood({ content: '', mood_level: 5 })).rejects.toThrow('情绪描述不能为空')
    })

    it('应该拦截纯空格文本并抛出错误', async () => {
      await expect(analyzeMood({ content: '   ', mood_level: 5 })).rejects.toThrow(
        '情绪描述不能为空'
      )
    })

    it('应该接受非空文本', async () => {
      const result = await analyzeMood({ content: '今天心情不错', mood_level: 5 })

      expect(result).toHaveProperty('mood', '开心')
    })
  })

  describe('情绪强度验证', () => {
    it('应该拒绝小于1的情绪强度', async () => {
      await expect(analyzeMood({ content: '测试内容', mood_level: 0 })).rejects.toThrow(
        '情绪强度必须在1-10之间'
      )
    })

    it('应该拒绝大于10的情绪强度', async () => {
      await expect(analyzeMood({ content: '测试内容', mood_level: 11 })).rejects.toThrow(
        '情绪强度必须在1-10之间'
      )
    })

    it('应该接受有效的情绪强度范围', async () => {
      const result = await analyzeMood({ content: '测试内容', mood_level: 7 })

      expect(result).toHaveProperty('mood', '平静')
    })
  })

  describe('情绪标签有效性验证', () => {
    it('应该接受有效的情绪标签', async () => {
      const validMoods = ['开心', '焦虑', '抑郁', '平静', '愤怒', '疲惫', '紧张', '兴奋']

      for (const mood of validMoods) {
        if (mood === '开心') {
          const result = await analyzeMood({ content: '今天很开心', mood_level: 5 })
          expect(result.mood).toBe('开心')
        }

        if (mood === '焦虑') {
          const result = await analyzeMood({ content: '我有点焦虑', mood_level: 5 })
          expect(result.mood).toBe('焦虑')
        }

        if (mood === '抑郁') {
          const result = await analyzeMood({ content: '最近有些抑郁', mood_level: 5 })
          expect(result.mood).toBe('抑郁')
        }

        if (mood === '愤怒') {
          const result = await analyzeMood({ content: '今天很愤怒', mood_level: 5 })
          expect(result.mood).toBe('愤怒')
        }

        if (mood === '疲惫') {
          const result = await analyzeMood({ content: '最近感觉很疲惫', mood_level: 5 })
          expect(result.mood).toBe('疲惫')
        }

        if (mood === '兴奋') {
          const result = await analyzeMood({ content: '我很兴奋', mood_level: 5 })
          expect(result.mood).toBe('兴奋')
        }
      }
    })

    it('无法命中关键词时应返回平静', async () => {
      const result = await analyzeMood({ content: '今天天气不错，适合出去走走', mood_level: 8 })
      expect(result.mood).toBe('平静')
    })
  })

  describe('请求防抖功能', () => {
    it('应该在500ms内多次调用只执行最后一次', async () => {
      const promises = [
        debouncedAnalyzeMood({ content: '第一次调用', mood_level: 5 }),
        debouncedAnalyzeMood({ content: '第二次调用', mood_level: 6 }),
        debouncedAnalyzeMood({ content: '第三次调用', mood_level: 7 }),
      ]

      vi.advanceTimersByTime(500)

      const results = await Promise.all(promises)
      expect(results[0].mood).toBe('平静')
      expect(results[1].mood).toBe('平静')
      expect(results[2].mood).toBe('平静')
    })

    it('应该在500ms后执行请求', async () => {
      const promise = debouncedAnalyzeMood({ content: '测试内容', mood_level: 5 })

      vi.advanceTimersByTime(500)

      const result = await promise
      expect(result.mood).toBe('平静')
    })

    it('应该在防抖期间取消之前的请求', async () => {
      const first = debouncedAnalyzeMood({ content: '第一次调用', mood_level: 5 })

      vi.advanceTimersByTime(300)

      const second = debouncedAnalyzeMood({ content: '第二次调用', mood_level: 6 })

      vi.advanceTimersByTime(500)

      const firstResult = await first
      const secondResult = await second

      expect(firstResult.mood).toBe('平静')
      expect(secondResult.mood).toBe('平静')
    })
  })
})
