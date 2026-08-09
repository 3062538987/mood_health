import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import {
  getMyCases,
  getCaseDetail,
  createCase,
  assignCase,
  addIntervention,
  closeCase,
} from '@/api/case'

const requestMock = vi.mocked(request)

describe('个案管理系统', () => {
  describe('获取个案列表', () => {
    it('获取我的个案', async () => {
      requestMock.mockResolvedValueOnce([
        {
          id: 1,
          studentUserId: 200,
          assignedCounselorId: 100,
          sourceSessionId: null,
          status: 'open',
          riskLevel: 'medium',
          summary: '学生表达了焦虑情绪',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ])

      const result = await getMyCases()

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('open')
      expect(result[0].riskLevel).toBe('medium')
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/cases',
        method: 'get',
      })
    })
  })

  describe('个案详情', () => {
    it('获取个案详情含干预记录', async () => {
      requestMock.mockResolvedValueOnce({
        case: {
          id: 1,
          studentUserId: 200,
          assignedCounselorId: 100,
          sourceSessionId: null,
          status: 'in_progress',
          riskLevel: 'medium',
          summary: '学生表达了焦虑情绪',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        interventions: [
          {
            id: 1,
            caseId: 1,
            counselorUserId: 100,
            interventionType: 'note',
            content: '与学生进行了初步沟通',
            referralTarget: null,
            referralReason: null,
            closureSummary: null,
            createdAt: '2026-01-02T00:00:00Z',
          },
        ],
      })

      const result = await getCaseDetail(1)

      expect(result.case.id).toBe(1)
      expect(result.interventions).toHaveLength(1)
      expect(result.interventions[0].interventionType).toBe('note')
    })
  })

  describe('创建个案', () => {
    it('创建新个案', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1,
        studentUserId: 200,
        assignedCounselorId: null,
        sourceSessionId: null,
        status: 'open',
        riskLevel: 'high',
        summary: '需要紧急关注',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })

      const result = await createCase({
        studentUserId: 200,
        riskLevel: 'high',
        summary: '需要紧急关注',
      })

      expect(result.status).toBe('open')
      expect(result.riskLevel).toBe('high')
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/cases',
        method: 'post',
        data: { studentUserId: 200, riskLevel: 'high', summary: '需要紧急关注' },
      })
    })
  })

  describe('分配个案', () => {
    it('分配咨询师', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1,
        studentUserId: 200,
        assignedCounselorId: 100,
        sourceSessionId: null,
        status: 'assigned',
        riskLevel: 'medium',
        summary: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })

      const result = await assignCase(1, { counselorId: 100 })

      expect(result.status).toBe('assigned')
      expect(result.assignedCounselorId).toBe(100)
    })
  })

  describe('添加干预', () => {
    it('添加干预记录', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1,
        caseId: 1,
        counselorUserId: 100,
        interventionType: 'interview',
        content: '面对面访谈记录',
        referralTarget: null,
        referralReason: null,
        closureSummary: null,
        createdAt: '2026-01-01T00:00:00Z',
      })

      const result = await addIntervention(1, {
        interventionType: 'interview',
        content: '面对面访谈记录',
      })

      expect(result.interventionType).toBe('interview')
      expect(result.content).toBe('面对面访谈记录')
    })
  })

  describe('关闭个案', () => {
    it('关闭个案', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1,
        studentUserId: 200,
        assignedCounselorId: 100,
        sourceSessionId: null,
        status: 'closed',
        riskLevel: 'low',
        summary: '已解决',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
      })

      const result = await closeCase(1, { summary: '学生情绪已稳定，建议持续观察' })

      expect(result.status).toBe('closed')
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/cases/1/close',
        method: 'put',
        data: { summary: '学生情绪已稳定，建议持续观察' },
      })
    })
  })
})