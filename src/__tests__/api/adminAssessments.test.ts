import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

import request from '@/utils/request'
import { getAdminAssessments, getAdminAssessmentDetail } from '@/api/adminAssessments'

const requestMock = vi.mocked(request)

describe('管理端测评 API', () => {
  it('列表请求携带正确的 url、method 与筛选参数', async () => {
    requestMock.mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })

    await getAdminAssessments({ riskLevel: 'high', page: 1, pageSize: 20, startDate: '2026-01-01' })

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/admin/assessments',
      method: 'get',
      params: { riskLevel: 'high', page: 1, pageSize: 20, startDate: '2026-01-01' },
    })
  })

  it('详情请求指向带 id 的端点', async () => {
    requestMock.mockResolvedValue({
      id: 42,
      userId: 7,
      username: 'student',
      instrumentName: 'PHQ-9',
      versionLabel: 'v1',
      rawScore: 12,
      screeningLevel: 'moderate',
      resultSummary: {},
      answers: [],
      startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-01T00:05:00Z',
    })

    await getAdminAssessmentDetail(42)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/admin/assessments/42',
      method: 'get',
    })
  })
})
