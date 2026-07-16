import request from '@/utils/request'
import axios from 'axios'

interface RelaxRecord {
  id?: string
  userId: string
  activityType: 'woodenFish' | 'breathing' | 'pinball' | 'tetris' | 'audio'
  startTime: string
  endTime: string
  metrics: Record<string, any>
  moodTag?: string
}

interface RelaxStatistics {
  todayDuration: number
  thisWeekCount: number
  mostUsedActivity: string
  activityBreakdown: Array<{
    type: string
    count: number
    duration: number
  }>
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

class RelaxAPI {
  /**
   * 保存放松记录
   * @param record 放松记录数据
   */
  async saveRecord(record: Omit<RelaxRecord, 'id'>): Promise<RelaxRecord> {
    const response = await request<RelaxRecord>({
      url: '/api/relax/records',
      method: 'post',
      data: record,
    })
    return response
  }

  /**
   * 获取放松记录列表
   * @param params 查询参数
   */
  async getRecords(params?: {
    startDate?: string
    endDate?: string
    activityType?: string
    page?: number
    pageSize?: number
  }): Promise<{
    records: RelaxRecord[]
    total: number
  }> {
    const response = await request<{
      records: RelaxRecord[]
      total: number
    }>({
      url: '/api/relax/records',
      method: 'get',
      params,
    })
    return response
  }

  /**
   * 获取放松统计数据
   * @param params 查询参数
   */
  async getStatistics(params?: { startDate?: string; endDate?: string }): Promise<RelaxStatistics> {
    const response = await request<RelaxStatistics>({
      url: '/api/relax/statistics',
      method: 'get',
      params,
    })
    return response
  }

  /**
   * 获取单个放松记录详情
   * @param id 记录ID
   */
  async getRecordDetail(id: string): Promise<RelaxRecord> {
    const response = await request<RelaxRecord>({
      url: `/api/relax/records/${id}`,
      method: 'get',
    })
    return response
  }

  async saveRecordSafe(record: Omit<RelaxRecord, 'id'>): Promise<SafeResult<RelaxRecord>> {
    try {
      const data = await this.saveRecord(record)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '保存放松记录失败') }
    }
  }

  async getRecordsSafe(params?: {
    startDate?: string
    endDate?: string
    activityType?: string
    page?: number
    pageSize?: number
  }): Promise<SafeResult<{ records: RelaxRecord[]; total: number }>> {
    try {
      const data = await this.getRecords(params)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '获取放松记录失败') }
    }
  }

  async getStatisticsSafe(params?: {
    startDate?: string
    endDate?: string
  }): Promise<SafeResult<RelaxStatistics>> {
    try {
      const data = await this.getStatistics(params)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...toSafeError(error, '获取放松统计失败') }
    }
  }
}

export default new RelaxAPI()
export type { RelaxRecord, RelaxStatistics }
