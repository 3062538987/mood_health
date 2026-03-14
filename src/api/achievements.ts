import request from '@/utils/request';

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: string;
  threshold: number;
  icon: string;
  level: 'bronze' | 'silver' | 'gold';
}

interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  achievement: Achievement;
}

interface AchievementProgress {
  achievementId: string;
  current: number;
  target: number;
  isUnlocked: boolean;
}

class AchievementAPI {
  /**
   * 获取所有成就列表
   */
  async getAchievements(): Promise<Achievement[]> {
    const response = await request<Achievement[]>({
      url: '/api/achievements',
      method: 'get'
    });
    return response;
  }

  /**
   * 获取用户已解锁的成就
   */
  async getUserAchievements(): Promise<UserAchievement[]> {
    const response = await request<UserAchievement[]>({
      url: '/api/achievements/user',
      method: 'get'
    });
    return response;
  }

  /**
   * 检查成就
   */
  async checkAchievements(): Promise<UserAchievement[]> {
    const response = await request<UserAchievement[]>({
      url: '/api/achievements/check',
      method: 'post'
    });
    return response;
  }

  /**
   * 获取成就进度
   */
  async getAchievementProgress(): Promise<AchievementProgress[]> {
    const response = await request<AchievementProgress[]>({
      url: '/api/achievements/progress',
      method: 'get'
    });
    return response;
  }
}

export default new AchievementAPI();
export type { Achievement, UserAchievement, AchievementProgress };
