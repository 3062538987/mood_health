import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import relaxAPI from '@/api/relax'

const requestMock = vi.mocked(request)

describe('放松系统', () => {

  describe('保存放松记录', () => {
    it('保存木鱼敲击记录', async () => {
      requestMock.mockResolvedValueOnce({
        id: '1',
        userId: '100',
        activityType: 'woodenFish',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T10:05:00Z',
        metrics: { taps: 50 },
        moodTag: '开心',
      })

      const result = await relaxAPI.saveRecord({
        userId: '100',
        activityType: 'woodenFish',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T10:05:00Z',
        metrics: { taps: 50 },
        moodTag: '开心',
      })

      expect(result.activityType).toBe('woodenFish')
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/relax/records',
        method: 'post',
        data: expect.objectContaining({ activityType: 'woodenFish' }),
      })
    })

    it('saveRecordSafe 处理错误', async () => {
      requestMock.mockRejectedValueOnce(new Error('保存失败'))

      const result = await relaxAPI.saveRecordSafe({
        userId: '100',
        activityType: 'breathing',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T10:03:00Z',
        metrics: { cycles: 10 },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBeDefined()
      }
    })
  })

  describe('获取放松记录', () => {
    it('获取记录列表', async () => {
      requestMock.mockResolvedValueOnce({
        records: [],
        total: 0,
      })

      const result = await relaxAPI.getRecords({ page: 1, pageSize: 10 })

      expect(result.records).toEqual([])
      expect(result.total).toBe(0)
    })

    it('按活动类型筛选', async () => {
      requestMock.mockResolvedValueOnce({ records: [], total: 0 })

      await relaxAPI.getRecords({ activityType: 'breathing' })

      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/relax/records',
        method: 'get',
        params: { activityType: 'breathing' },
      })
    })
  })

  describe('获取放松统计', () => {
    it('获取统计数据', async () => {
      requestMock.mockResolvedValueOnce({
        todayDuration: 600,
        thisWeekCount: 5,
        mostUsedActivity: 'breathing',
        activityBreakdown: [
          { type: 'breathing', count: 3, duration: 300 },
          { type: 'woodenFish', count: 2, duration: 200 },
        ],
      })

      const result = await relaxAPI.getStatistics()

      expect(result.todayDuration).toBe(600)
      expect(result.mostUsedActivity).toBe('breathing')
      expect(result.activityBreakdown).toHaveLength(2)
    })
  })
})