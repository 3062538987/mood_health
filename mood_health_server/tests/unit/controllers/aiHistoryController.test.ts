/**
 * AI 分析历史控制器测试
 */

import { saveHistory, listHistory, getHistoryDetail } from '../../../src/controllers/aiHistoryController'

jest.mock('../../../src/repositories/aiHistoryRepository', () => ({
  createAiHistoryRepository: jest.fn(() => ({
    saveHistory: jest.fn().mockResolvedValue(1),
    listHistory: jest.fn().mockResolvedValue({ list: [], total: 0 }),
    getHistoryDetail: jest.fn().mockResolvedValue(null),
  })),
}))

describe('aiHistoryController', () => {
  const mockReq = (overrides: Record<string, unknown> = {}) => {
    const req = {
      user: { userId: 1, username: 'test', role: 'user' },
      body: {},
      query: {},
      params: {},
      ...overrides,
    } as any
    return req
  }

  const mockRes = () => {
    const res: any = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
  }

  describe('saveHistory', () => {
    it('未登录返回 401', async () => {
      const req = mockReq({ user: undefined })
      const res = mockRes()
      await saveHistory(req, res)
      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('缺少必要参数返回 400', async () => {
      const req = mockReq({ body: { analysis_type: '' } })
      const res = mockRes()
      await saveHistory(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('listHistory', () => {
    it('未登录返回 401', async () => {
      const req = mockReq({ user: undefined })
      const res = mockRes()
      await listHistory(req, res)
      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('空列表返回空数组', async () => {
      const req = mockReq()
      const res = mockRes()
      await listHistory(req, res)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 0,
        data: expect.objectContaining({ total: 0, list: [] }),
      }))
    })
  })

  describe('getHistoryDetail', () => {
    it('未登录返回 401', async () => {
      const req = mockReq({ user: undefined })
      const res = mockRes()
      await getHistoryDetail(req, res)
      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('无效 ID 返回 400', async () => {
      const req = mockReq({ params: { id: 'abc' } })
      const res = mockRes()
      await getHistoryDetail(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('不存在的记录返回 404', async () => {
      const req = mockReq({ params: { id: '999' } })
      const res = mockRes()
      await getHistoryDetail(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
    })
  })
})