import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import achievementAPI from '@/api/achievements'

const requestMock = vi.mocked(request)

describe('成就系统', () => {

  describe('获取成就列表', () => {
    it('获取所有成就', async () => {
      requestMock.mockResolvedValueOnce([
        { id: '1', name: '首次记录', description: '完成第一次情绪记录', type: 'mood', threshold: 1, icon: '🎯', level: 'bronze' },
        { id: '2', name: '坚持一周', description: '连续7天记录情绪', type: 'streak', threshold: 7, icon: '🔥', level: 'silver' },
      ])

      const result = await achievementAPI.getAchievements()

      expect(result).toHaveLength(2)
      expect(result[0].level).toBe('bronze')
      expect(result[1].level).toBe('silver')
    })

    it('getAchievementsSafe 成功返回', async () => {
      requestMock.mockResolvedValueOnce([])

      const result = await achievementAPI.getAchievementsSafe()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual([])
      }
    })

    it('getAchievementsSafe 处理错误', async () => {
      requestMock.mockRejectedValueOnce(new Error('获取失败'))

      const result = await achievementAPI.getAchievementsSafe()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('用户成就', () => {
    it('获取用户已解锁成就', async () => {
      requestMock.mockResolvedValueOnce([
        {
          id: '1',
          userId: '100',
          achievementId: '1',
          unlockedAt: '2026-01-01T00:00:00Z',
          achievement: {
            id: '1',
            name: '首次记录',
            description: '完成第一次情绪记录',
            type: 'mood',
            threshold: 1,
            icon: '🎯',
            level: 'bronze',
          },
        },
      ])

      const result = await achievementAPI.getUserAchievements()

      expect(result).toHaveLength(1)
      expect(result[0].achievement.name).toBe('首次记录')
    })

    it('检查成就', async () => {
      requestMock.mockResolvedValueOnce([])

      const result = await achievementAPI.checkAchievements()

      expect(result).toEqual([])
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/achievements/check',
        method: 'post',
      })
    })
  })

  describe('成就进度', () => {
    it('获取成就进度', async () => {
      requestMock.mockResolvedValueOnce([
        { achievementId: '1', current: 1, target: 1, isUnlocked: true },
        { achievementId: '2', current: 3, target: 7, isUnlocked: false },
      ])

      const result = await achievementAPI.getAchievementProgress()

      expect(result).toHaveLength(2)
      expect(result[0].isUnlocked).toBe(true)
      expect(result[1].isUnlocked).toBe(false)
    })
  })
})