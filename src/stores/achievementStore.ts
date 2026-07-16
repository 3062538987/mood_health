import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import achievementAPI, {
  type Achievement,
  type UserAchievement,
  type AchievementProgress,
} from '@/api/achievements'
import storageUtil from '@/utils/storageUtil'

const useAchievementStore = defineStore('achievement', () => {
  // 状态
  const achievements = ref<Achievement[]>([])
  const userAchievements = ref<UserAchievement[]>([])
  const progress = ref<AchievementProgress[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const newAchievements = ref<UserAchievement[]>([])

  // 计算属性
  const unlockedAchievements = computed(() => {
    return userAchievements.value
  })

  const lockedAchievements = computed(() => {
    const unlockedIds = new Set(userAchievements.value.map((ua) => ua.achievementId))
    return achievements.value.filter((achievement) => !unlockedIds.has(achievement.id))
  })

  const getAchievementProgress = computed(() => {
    return (achievementId: string) => {
      return progress.value.find((p) => p.achievementId === achievementId)
    }
  })

  // 方法
  /**
   * 加载所有成就
   */
  async function fetchAchievements() {
    isLoading.value = true
    error.value = null

    try {
      const result = await achievementAPI.getAchievementsSafe()
      if (result.ok) {
        achievements.value = result.data
        return result.data
      }
      error.value = result.message
      achievements.value = []
      return []
    } catch (err) {
      error.value = '获取成就列表失败'
      console.error('获取成就列表失败:', err)
      achievements.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载用户成就
   */
  async function fetchUserAchievements() {
    isLoading.value = true
    error.value = null

    try {
      const result = await achievementAPI.getUserAchievementsSafe()
      if (result.ok) {
        userAchievements.value = result.data
        return result.data
      }
      error.value = result.message
      userAchievements.value = []
      return []
    } catch (err) {
      error.value = '获取用户成就失败'
      console.error('获取用户成就失败:', err)
      userAchievements.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载成就进度
   */
  async function fetchAchievementProgress() {
    isLoading.value = true
    error.value = null

    try {
      const result = await achievementAPI.getAchievementProgressSafe()
      if (result.ok) {
        progress.value = result.data
        return result.data
      }
      error.value = result.message
      progress.value = []
      return []
    } catch (err) {
      error.value = '获取成就进度失败'
      console.error('获取成就进度失败:', err)
      progress.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 检查成就
   */
  async function checkAchievements() {
    isLoading.value = true
    error.value = null

    try {
      const result = await achievementAPI.checkAchievementsSafe()
      if (!result.ok) {
        error.value = result.message
        return []
      }
      const newlyUnlocked = result.data
      if (newlyUnlocked.length > 0) {
        // 更新用户成就列表
        const existingIds = new Set(userAchievements.value.map((ua) => ua.id))
        const newItems = newlyUnlocked.filter((ua) => !existingIds.has(ua.id))
        userAchievements.value = [...userAchievements.value, ...newItems]
        newAchievements.value = newItems
        return newItems
      }
      return []
    } catch (err) {
      error.value = '检查成就失败'
      console.error('检查成就失败:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 清除新成就通知
   */
  function clearNewAchievements() {
    newAchievements.value = []
  }

  /**
   * 初始化store
   */
  async function init() {
    await Promise.allSettled([
      fetchAchievements(),
      fetchUserAchievements(),
      fetchAchievementProgress(),
    ])
  }

  return {
    // 状态
    achievements,
    userAchievements,
    progress,
    isLoading,
    error,
    newAchievements,
    // 计算属性
    unlockedAchievements,
    lockedAchievements,
    getAchievementProgress,
    // 方法
    fetchAchievements,
    fetchUserAchievements,
    fetchAchievementProgress,
    checkAchievements,
    clearNewAchievements,
    init,
  }
})

export default useAchievementStore
