import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import {
  createAdminCourse,
  getAdminAuditLogs,
  getAdminMoods,
  getAdminMusic,
  getAdminUsers,
  updateAdminCourse,
} from '@/api/admin'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

const requestMock = vi.mocked(request)

describe('admin API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('returns the unwrapped user list', async () => {
    const users = [
      {
        id: 1,
        username: 'student_demo',
        email: 'student@example.com',
        role: 'user' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    requestMock.mockResolvedValueOnce({ list: users })

    await expect(getAdminUsers()).resolves.toEqual(users)
  })

  it('returns the unwrapped audit log list', async () => {
    const logs = [
      {
        id: 1,
        operatorId: 2,
        operatorRole: 'super_admin',
        permissionCode: 'user.manage',
        operationType: 'USER_LIST',
        targetId: null,
        operationResult: 'success',
        operationTime: '2026-01-01T00:00:00.000Z',
      },
    ]
    requestMock.mockResolvedValueOnce({
      list: logs,
      pagination: { page: 1, pageSize: 50, total: 1 },
    })

    await expect(getAdminAuditLogs()).resolves.toEqual(logs)
  })

  it('returns the unwrapped music list', async () => {
    const music = [{ id: 1, title: '白噪音', artist: 'Mood Health' }]
    requestMock.mockResolvedValueOnce(music)

    await expect(getAdminMusic()).resolves.toEqual(music)
  })

  it('maps the video course form to the backend course contract', async () => {
    requestMock.mockResolvedValueOnce({ id: 1, title: '睡眠课' })

    await createAdminCourse({
      title: '睡眠课',
      description: '改善睡眠',
      category: '睡眠',
      content: '课程说明',
      videoUrl: 'https://example.com/sleep.mp4',
      coverImage: 'https://example.com/sleep.jpg',
    })

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: '睡眠课',
          description: '改善睡眠',
          category: '睡眠',
          coverUrl: 'https://example.com/sleep.jpg',
          content: 'https://example.com/sleep.mp4',
          type: 'video',
        },
      })
    )
  })

  it('maps an article course update without losing its content', async () => {
    requestMock.mockResolvedValueOnce({ id: 2, title: '情绪课' })

    await updateAdminCourse(2, {
      title: '情绪课',
      description: '理解情绪',
      category: '情绪管理',
      content: '正文内容',
      videoUrl: '',
      coverImage: '',
    })

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: '情绪课',
          description: '理解情绪',
          category: '情绪管理',
          coverUrl: '',
          content: '正文内容',
          type: 'article',
        },
      })
    )
  })

  it('returns only the minimal mood statistics DTO', async () => {
    const response = {
      list: [
        {
          id: 1,
          userId: 2,
          username: 'student_demo',
          moodType: ['平静'],
          intensity: 6,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }
    requestMock.mockResolvedValueOnce(response)

    const result = await getAdminMoods({ page: 1, pageSize: 20 })

    expect(result).toEqual(response)
    expect(result.list[0]).not.toHaveProperty('note')
    expect(result.list[0]).not.toHaveProperty('trigger')
  })
})
