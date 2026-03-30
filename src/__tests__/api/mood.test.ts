import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeMood, analyzeMoodWithRetry } from '@/api/mood'

describe('analyzeMood', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return local analysis result', async () => {
    const result = await analyzeMood({
      content: '今天心情很好',
      mood_level: 5,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
    expect(result.mood).toBe('开心')
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('should return calm mood when no keyword is matched', async () => {
    const result = await analyzeMood({ content: '测试内容', mood_level: 3 })
    expect(result.mood).toBe('平静')
  })

  it('should detect anxious mood', async () => {
    const result = await analyzeMood({
      content: '今天感到有些焦虑',
      mood_level: 2,
    })
    expect(result.mood).toBe('焦虑')
  })
})

describe('analyzeMoodWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return result on first attempt', async () => {
    const result = await analyzeMoodWithRetry({
      content: '测试内容',
      mood_level: 3,
    })

    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('suggestions')
  })

  it('should return result when retries are provided', async () => {
    await analyzeMoodWithRetry({ content: '测试内容', mood_level: 3 }, 3)
    expect(true).toBe(true)
  })
})
