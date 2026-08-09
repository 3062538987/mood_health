import request from '@/utils/request'
import axios from 'axios'
import type { Post, Comment, AiReply, CreatePostData, CreateCommentData } from '@/types/post'

type SafeResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number }

interface RawAiReply {
  id?: number
  postId?: number
  post_id?: number
  content?: string
  createdAt?: string
  created_at?: string
}

interface RawComment {
  id?: number
  postId?: number
  post_id?: number
  userId?: number
  user_id?: number
  username?: string
  content?: string
  isAnonymous?: boolean
  is_anonymous?: boolean
  createdAt?: string
  created_at?: string
  liked?: boolean
  like_count?: number
}

interface RawPost {
  id?: number
  userId?: number
  user_id?: number
  username?: string
  title?: string
  content?: string
  isAnonymous?: boolean
  is_anonymous?: boolean
  likes?: number
  like_count?: number
  liked?: boolean
  status?: number
  audit_remark?: string | null
  auditRemark?: string | null
  commentCount?: number
  comment_count?: number
  createdAt?: string
  created_at?: string
  hasAiReply?: boolean
  has_ai_reply?: boolean
  aiReply?: RawAiReply
  comments?: RawComment[]
}

const normalizePost = (post: RawPost): Post => ({
  id: post.id as number,
  userId: post.userId ?? post.user_id ?? 0,
  username: post.username || '匿名用户',
  title: post.title || '未命名帖子',
  content: post.content || '',
  isAnonymous: Boolean(post.isAnonymous ?? post.is_anonymous),
  is_anonymous: Boolean(post.isAnonymous ?? post.is_anonymous),
  likes: Number(post.likes ?? post.like_count ?? 0),
  liked: Boolean(post.liked),
  like_count: Number(post.like_count ?? post.likes ?? 0),
  status: typeof post.status === 'number' ? post.status : undefined,
  audit_remark: post.audit_remark ?? post.auditRemark ?? null,
  commentCount: Number(post.commentCount ?? post.comment_count ?? 0),
  createdAt: post.createdAt || post.created_at || new Date().toISOString(),
  created_at: post.created_at || post.createdAt || new Date().toISOString(),
  hasAiReply: Boolean(post.hasAiReply ?? post.has_ai_reply),
  aiReply: post.aiReply ? {
    id: post.aiReply.id as number,
    postId: post.aiReply.postId ?? post.aiReply.post_id ?? 0,
    content: post.aiReply.content || '',
    createdAt: post.aiReply.createdAt || post.aiReply.created_at || '',
  } : undefined,
  comments: Array.isArray(post.comments)
    ? post.comments.map((item) => normalizeComment(item))
    : undefined,
})

const normalizeComment = (comment: RawComment): Comment => ({
  id: comment.id as number,
  postId: comment.postId ?? comment.user_id ?? 0,
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
  return request<{ list: RawPost[]; total: number }>({
    url: '/api/posts',
    method: 'get',
    params: { page, pageSize },
  }).then((response) => ({
    list: (response.list || []).map((item) => normalizePost(item)),
    total: Number(response.total || 0),
  }))
}

export const getPostDetail = (postId: number) => {
  return request<RawPost>({
    url: `/api/posts/${postId}`,
    method: 'get',
  }).then((response) => normalizePost(response))
}

export const createPost = (data: CreatePostData) => {
  return request<RawPost>({
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

export const deletePost = (postId: number) => {
  return request<{ message: string }>({
    url: `/api/posts/${postId}`,
    method: 'delete',
  })
}

export const getComments = (postId: number) => {
  return request<RawComment[]>({
    url: `/api/posts/${postId}/comments`,
    method: 'get',
  }).then((response) => response.map((item) => normalizeComment(item)))
}

export const createComment = (data: CreateCommentData) => {
  return request<RawComment>({
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

export const getPendingPosts = (page = 1, pageSize = 10, status = 0) => {
  return request<RawPost[]>({
    url: '/api/posts/admin/pending',
    method: 'get',
    params: { page, pageSize, status },
  }).then((response) => response.map((item) => normalizePost(item)))
}

export const getPostAuditStats = () => {
  return request<{ pending: number; approved: number; rejected: number }>({
    url: '/api/posts/admin/stats',
    method: 'get',
  })
}

export const auditPost = (postId: number, data: { status: number; audit_remark?: string }) => {
  return request<RawPost>({
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

export const getAiReply = (postId: number) => {
  return request<AiReply | null>({
    url: `/api/posts/${postId}/ai-reply`,
    method: 'get',
  })
}

export const generateAiReply = (postId: number) => {
  return request<AiReply>({
    url: `/api/posts/${postId}/generate-ai-reply`,
    method: 'post',
  })
}
