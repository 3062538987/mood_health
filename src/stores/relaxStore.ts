import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import relaxAPI, { type RelaxRecord, type RelaxStatistics } from '@/api/relax'
import storageUtil from '@/utils/storageUtil'

const useRelaxStore = defineStore('relax', () => {
  // 状态
  const records = ref<RelaxRecord[]>([])
  const statistics = ref<RelaxStatistics | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 未登录时的暂存记录
  const pendingRecords = ref<RelaxRecord[]>([])

  // 计算属性
  const todayRecords = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return records.value.filter((record) => record.startTime.startsWith(today))
  })

  const totalRelaxTime = computed(() => {
    return records.value.reduce((total, record) => {
      const start = new Date(record.startTime).getTime()
      const end = new Date(record.endTime).getTime()
      return total + (end - start)
    }, 0)
  })

  // 方法
  /**
/**
   * 保存放松记录
   */
  async function saveRecord(record: Omit<RelaxRecord, 'id' | 'userId'>) {
    isLoading.value = true
    error.value = null

    try {
      const userId = 'current-user-id' // 临时值，实际应从用户状态获取

      if (userId) {
        // 已登录，直接保存到后端
        const savedResult = await relaxAPI.saveRecordSafe({
          ...record,
          userId,
        })
        if (!savedResult.ok) {
          throw new Error(savedResult.message)
        }
        const savedRecord = savedResult.data
        records.value.unshift(savedRecord)
        return savedRecord
      } else {
        // 未登录，暂存到localStorage
        const pendingRecord = {
          ...record,
          userId: 'anonymous',
        }
        pendingRecords.value.push(pendingRecord)
        storageUtil.setItem('pendingRelaxRecords', pendingRecords.value)
        return pendingRecord
      }
    } catch (err) {
      error.value = '保存记录失败'
      console.error('保存放松记录失败:', err)
      const fallbackRecord = {
        ...record,
        id: `local-${Date.now()}`,
        userId: 'anonymous',
      }
      pendingRecords.value.push(fallbackRecord)
      storageUtil.setItem('pendingRelaxRecords', pendingRecords.value)
      return fallbackRecord
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取放松记录列表
   */
  async function fetchRecords(params?: {
    startDate?: string
    endDate?: string
    activityType?: string
  }) {
    isLoading.value = true
    error.value = null

    try {
      const userId = 'current-user-id' // 临时值，实际应从用户状态获取

      if (userId) {
        const response = await relaxAPI.getRecordsSafe(params)
        if (response.ok) {
          records.value = response.data.records
          return response.data
        }

        error.value = response.message
        const storedRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
        records.value = storedRecords
        return { records: storedRecords, total: storedRecords.length }
      } else {
        // 未登录，从localStorage获取暂存记录
        const storedRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
        records.value = storedRecords
        return { records: storedRecords, total: storedRecords.length }
      }
    } catch (err) {
      error.value = '获取记录失败'
      console.error('获取放松记录失败:', err)
      const storedRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
      records.value = storedRecords
      return { records: storedRecords, total: storedRecords.length }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取统计数据
   */
  async function fetchStatistics(params?: { startDate?: string; endDate?: string }) {
    isLoading.value = true
    error.value = null

    try {
      const userId = 'current-user-id' // 临时值，实际应从用户状态获取

      if (userId) {
        const result = await relaxAPI.getStatisticsSafe(params)
        if (result.ok) {
          statistics.value = result.data
          return result.data
        }

        error.value = result.message
        const localStats = calculateLocalStatistics(params)
        statistics.value = localStats
        return localStats
      } else {
        // 未登录，使用本地数据计算
        const localStats = calculateLocalStatistics(params)
        statistics.value = localStats
        return localStats
      }
    } catch (err) {
      error.value = '获取统计数据失败'
      console.error('获取放松统计数据失败:', err)
      const localStats = calculateLocalStatistics(params)
      statistics.value = localStats
      return localStats
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 计算本地统计数据
   */
  function calculateLocalStatistics(params?: {
    startDate?: string
    endDate?: string
  }): RelaxStatistics {
    let filteredRecords = records.value

    // 应用日期过滤
    if (params?.startDate) {
      filteredRecords = filteredRecords.filter((record) => record.startTime >= params.startDate!)
    }

    if (params?.endDate) {
      filteredRecords = filteredRecords.filter((record) => record.startTime <= params.endDate!)
    }

    // 计算统计数据
    const activityCounts = filteredRecords.reduce(
      (counts, record) => {
        counts[record.activityType] = (counts[record.activityType] || 0) + 1
        return counts
      },
      {} as Record<string, number>
    )

    const activityBreakdown = Object.entries(activityCounts).map(([type, count]) => {
      const typeRecords = filteredRecords.filter((r) => r.activityType === (type as any))
      const duration = typeRecords.reduce((total, record) => {
        const start = new Date(record.startTime).getTime()
        const end = new Date(record.endTime).getTime()
        return total + (end - start)
      }, 0)

      return {
        type,
        count,
        duration,
      }
    })

    // 找出最常用的活动
    let mostUsedActivity = ''
    let maxCount = 0
    Object.entries(activityCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostUsedActivity = type
      }
    })

    // 计算今日总时长
    const today = new Date().toISOString().split('T')[0]
    const todayRecords = filteredRecords.filter((record) => record.startTime.startsWith(today))
    const todayDuration = todayRecords.reduce((total, record) => {
      const start = new Date(record.startTime).getTime()
      const end = new Date(record.endTime).getTime()
      return total + (end - start)
    }, 0)

    // 计算本周次数
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const thisWeekCount = filteredRecords.filter(
      (record) => new Date(record.startTime) >= weekAgo
    ).length

    return {
      todayDuration,
      thisWeekCount,
      mostUsedActivity,
      activityBreakdown,
    }
  }

  /**
   * 同步未登录时的暂存记录
   */
  async function syncPendingRecords() {
    const storedPendingRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
    const userId = 'current-user-id' // 临时值，实际应从用户状态获取

    if (userId && storedPendingRecords.length > 0) {
      for (const record of storedPendingRecords) {
        try {
          await relaxAPI.saveRecord({
            ...record,
            userId,
          })
        } catch (err) {
          console.error('同步暂存记录失败:', err)
        }
      }

      // 清空暂存记录
      storageUtil.removeItem('pendingRelaxRecords')
      pendingRecords.value = []
    }
  }

  /**
   * 初始化store
   */
  function init() {
    // 从localStorage加载暂存记录
    const storedPendingRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
    pendingRecords.value = storedPendingRecords
  }

  return {
    records,
    statistics,
    isLoading,
    error,
    pendingRecords,
    todayRecords,
    totalRelaxTime,
    saveRecord,
    fetchRecords,
    fetchStatistics,
    syncPendingRecords,
    init,
  }
})

export default useRelaxStore
