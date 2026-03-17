import request from '@/utils/request'
import axios from 'axios'

interface Achievement {
  id: string
  name: string
  description: string
  type: string
  threshold: number
  icon: string
  level: 'bronze' | 'silver' | 'gold'
}

interface UserAchievement {
  id: string
  userId: string
  achievementId: string
  unlockedAt: string
  achievement: Achievement
}

interface AchievementProgress {
  achievementId: string
  current: number
  target: number
  isUnlocked: boolean
}

type SafeResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number }

const toSafeError = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return {
      message: (error.response?.data as { message?: string } | undefined)?.message || fallback,
      status: error.response?.status,
    }
  }
  return {
    message: error instanceof Error ? error.message : fallback,
  }
}

class AchievementAPI {
  /**
   * 获取所有成就列表
   */
  async getAchievements(): Promise<Achievement[]> {
    const response = await request<Achievement[]>({
      url: '/api/achievements',
      method: 'get',
    })
    return response
  }

  /**
   * 获取用户已解锁的成就
   */
  async getUserAchievements(): Promise<UserAchievement[]> {
    const response = await request<UserAchievement[]>({
      url: '/api/achievements/user',
      method: 'get',
    })
    return response
  }

  /**
   * 检查成就
   */
  async checkAchievements(): Promise<UserAchievement[]> {
    const response = await request<UserAchievement[]>({
      url: '/api/achievements/check',
      method: 'post',
    })
    return response
  }

  /**
   * 获取成就进度
   */
  async getAchievementProgress(): Promise<AchievementProgress[]> {
    const response = await request<AchievementProgress[]>({
      url: '/api/achievements/progress',
      method: 'get',
    })
    return response
  }

  async getAchievementsSafe(): Promise<SafeResult<Achievement[]>> {
    try {
      const data = await this.getAchievements()
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '获取成就列表失败') }
    }
  }

  async getUserAchievementsSafe(): Promise<SafeResult<UserAchievement[]>> {
    try {
      const data = await this.getUserAchievements()
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '获取用户成就失败') }
    }
  }

  async checkAchievementsSafe(): Promise<SafeResult<UserAchievement[]>> {
    try {
      const data = await this.checkAchievements()
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '检查成就失败') }
    }
  }

  async getAchievementProgressSafe(): Promise<SafeResult<AchievementProgress[]>> {
    try {
      const data = await this.getAchievementProgress()
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '获取成就进度失败') }
    }
  }
}

export default new AchievementAPI()
export type { Achievement, UserAchievement, AchievementProgress }
