import request from '@/utils/request'
import axios from 'axios'
import type { Post, Comment, CreatePostData, CreateCommentData } from '@/types/post'

type SafeResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number }

const normalizePost = (post: Record<string, any>): Post => ({
  id: post.id,
  userId: post.userId ?? post.user_id ?? 0,
  username: post.username || '匿名用户',
  title: post.title || '未命名帖子',
  content: post.content || '',
  isAnonymous: Boolean(post.isAnonymous ?? post.is_anonymous),
  likes: Number(post.likes ?? post.like_count ?? 0),
  liked: Boolean(post.liked),
  like_count: Number(post.like_count ?? post.likes ?? 0),
  commentCount: Number(post.commentCount ?? post.comment_count ?? 0),
  createdAt: post.createdAt || post.created_at || new Date().toISOString(),
  comments: Array.isArray(post.comments)
    ? post.comments.map((item) => normalizeComment(item))
    : undefined,
})

const normalizeComment = (comment: Record<string, any>): Comment => ({
  id: comment.id,
  postId: comment.postId ?? comment.post_id,
  userId: comment.userId ?? comment.user_id ?? 0,
  username: comment.username || '匿名用户',
  content: comment.content || '',
  isAnonymous: Boolean(comment.isAnonymous ?? comment.is_anonymous),
  createdAt: comment.createdAt || comment.created_at || new Date().toISOString(),
  liked: Boolean(comment.liked),
  like_count: Number(comment.like_count ?? 0),
})

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

export const getPostList = (page = 1, pageSize = 10) => {
  return request<{ list: Record<string, any>[]; total: number }>({
    url: '/api/posts',
    method: 'get',
    params: { page, pageSize },
  }).then((response) => ({
    list: (response.list || []).map((item) => normalizePost(item)),
    total: Number(response.total || 0),
  }))
}

export const getPostDetail = (postId: number) => {
  return request<Record<string, any>>({
    url: `/api/posts/${postId}`,
    method: 'get',
  }).then((response) => normalizePost(response))
}

export const createPost = (data: CreatePostData) => {
  return request<Record<string, any>>({
    url: '/api/posts',
    method: 'post',
    data,
  }).then((response) => normalizePost(response))
}

export const likePost = (postId: number) => {
  return request<{ like_count: number; liked: boolean }>({
    url: `/api/posts/${postId}/like`,
    method: 'post',
  })
}

export const getComments = (postId: number) => {
  return request<Record<string, any>[]>({
    url: `/api/posts/${postId}/comments`,
    method: 'get',
  }).then((response) => response.map((item) => normalizeComment(item)))
}

export const createComment = (data: CreateCommentData) => {
  return request<Record<string, any>>({
    url: `/api/posts/${data.postId}/comments`,
    method: 'post',
    data: { content: data.content, isAnonymous: data.isAnonymous },
  }).then((response) => normalizeComment(response))
}

export const likeComment = (commentId: number) => {
  return request<{ like_count: number; liked: boolean }>({
    url: `/api/posts/comments/${commentId}/like`,
    method: 'post',
  })
}

export const getPendingPosts = (page = 1, pageSize = 10) => {
  return request<Record<string, any>[]>({
    url: '/api/posts/admin/pending',
    method: 'get',
    params: { page, pageSize },
  }).then((response) => response.map((item) => normalizePost(item)))
}

export const auditPost = (postId: number, data: { status: number; audit_remark?: string }) => {
  return request<Record<string, any>>({
    url: `/api/posts/admin/audit/${postId}`,
    method: 'post',
    data,
  }).then((response) => normalizePost(response))
}

export const getPostListSafe = async (
  page = 1,
  pageSize = 10
): Promise<SafeResult<{ list: Post[]; total: number }>> => {
  try {
    const data = await getPostList(page, pageSize)
    return { ok: true, data }
  } catch (error) {
    return { ok: false, ...toSafeError(error, '加载帖子失败') }
  }
}
