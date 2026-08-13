import { Response } from 'express'

const mockDataService = {
  listAnalyses: jest.fn(),
}

jest.mock('../../../src/config/mysql', () => ({
  getMysqlPool: jest.fn(() => ({ query: jest.fn().mockResolvedValue([[], []]) })),
}))

jest.mock('../../../src/services/moodAnalysisDataService', () => {
  const actual = jest.requireActual('../../../src/services/moodAnalysisDataService')
  return {
    ...actual,
    createMoodAnalysisDataService: jest.fn(() => mockDataService),
  }
})

jest.mock('../../../src/services/analysisDispatcher', () => ({ analyzeMood: jest.fn() }))

const { listAnalyses } = require('../../../src/controllers/moodAnalysisController')

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('moodAnalysisController history contract', () => {
  it('returns the frontend history shape with version metadata', async () => {
    mockDataService.listAnalyses.mockResolvedValue({
      list: [{
        id: 8,
        period: '1m',
        dataVersion: 'version-1',
        recordCount: 12,
        dataRangeStart: '2026-07-01',
        dataRangeEnd: '2026-07-31',
        status: 'completed',
        analysisContent: { summary: 'month summary' },
        isStale: false,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:01:00.000Z',
      }],
      total: 1,
    })
    const response = createResponse()

    await listAnalyses({
      user: { userId: 7, username: 'student', role: 'student' },
      query: { period: '1m', page: '1', pageSize: '10' },
    } as never, response)

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 0,
      data: {
        data: [expect.objectContaining({
          id: '8',
          dataVersion: 'version-1',
          recordCount: 12,
          dateRange: '2026-07-01 至 2026-07-31',
          summary: 'month summary',
          isLatest: true,
        })],
        total: 1,
        page: 1,
        pageSize: 10,
      },
    }))
  })
})
