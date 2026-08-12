import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import { getActivityStats } from '@/api/activityApi'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

const requestMock = vi.mocked(request)

describe('activity statistics API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('returns the payload already unwrapped by the request interceptor', async () => {
    const stats = {
      totalActivities: 3,
      totalParticipants: 12,
      averageParticipants: 4,
      totalFeedback: 5,
      averageRating: 4.6,
      ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 3 },
    }
    requestMock.mockResolvedValueOnce(stats)

    await expect(getActivityStats({ startDate: '2026-08-01' })).resolves.toEqual(stats)
  })
})
