import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import { getPostList, getPostDetail, createPost, likePost, getComments, createComment } from '@/api/post'

const requestMock = vi.mocked(request)

describe('树洞帖子系统', () => {
  describe('获取帖子列表', () => {
    it('默认分页获取', async () => {
      requestMock.mockResolvedValueOnce({
        list: [
          { id: 1, userId: 100, username: '匿名用户', title: '帖子标题', content: '内容', isAnonymous: true, likes: 5, commentCount: 2, createdAt: '2026-01-01T00:00:00Z' },
        ],
        total: 1,
      })

      const result = await getPostList()

      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/posts',
        method: 'get',
        params: { page: 1, pageSize: 10 },
      })
    })

    it('自定义分页', async () => {
      requestMock.mockResolvedValueOnce({ list: [], total: 0 })

      await getPostList(2, 5)

      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/posts',
        method: 'get',
        params: { page: 2, pageSize: 5 },
      })
    })
  })

  describe('帖子详情', () => {
    it('获取帖子详情', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1, userId: 100, username: '用户A', title: '帖子标题', content: '内容', isAnonymous: false, likes: 10, commentCount: 3, createdAt: '2026-01-01T00:00:00Z',
      })

      const result = await getPostDetail(1)

      expect(result.id).toBe(1)
      expect(result.username).toBe('用户A')
      expect(requestMock).toHaveBeenCalledWith({
        url: '/api/posts/1',
        method: 'get',
      })
    })
  })

  describe('创建帖子', () => {
    it('创建匿名帖子', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1, userId: 100, username: '匿名用户', title: '新帖子', content: '内容', isAnonymous: true,
      })

      const result = await createPost({ title: '新帖子', content: '内容', isAnonymous: true })

      expect(result.title).toBe('新帖子')
      expect(result.isAnonymous).toBe(true)
    })
  })

  describe('点赞', () => {
    it('点赞帖子', async () => {
      requestMock.mockResolvedValueOnce({ like_count: 11, liked: true })

      const result = await likePost(1)

      expect(result.liked).toBe(true)
      expect(result.like_count).toBe(11)
    })
  })

  describe('评论', () => {
    it('获取评论列表', async () => {
      requestMock.mockResolvedValueOnce([
        { id: 1, postId: 1, userId: 100, username: '用户B', content: '评论内容', isAnonymous: false, createdAt: '2026-01-01T00:00:00Z' },
      ])

      const result = await getComments(1)

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('评论内容')
    })

    it('创建评论', async () => {
      requestMock.mockResolvedValueOnce({
        id: 1, postId: 1, userId: 100, username: '用户C', content: '新评论', isAnonymous: false,
      })

      const result = await createComment({ postId: 1, content: '新评论', isAnonymous: false })

      expect(result.content).toBe('新评论')
    })
  })
})