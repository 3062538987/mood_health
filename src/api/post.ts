import request from '@/utils/request';
import type { Post, Comment, CreatePostData, CreateCommentData } from '@/types/post';

export const getPostList = (page = 1, pageSize = 10) => {
  return request<{ list: Post[]; total: number }>({
    url: '/api/posts',
    method: 'get',
    params: { page, pageSize }
  });
};

export const getPostDetail = (postId: number) => {
  return request<Post>({
    url: `/api/posts/${postId}`,
    method: 'get'
  });
};

export const createPost = (data: CreatePostData) => {
  return request<Post>({
    url: '/api/posts',
    method: 'post',
    data
  });
};

export const likePost = (postId: number) => {
  return request<{ like_count: number; liked: boolean }>({
    url: `/api/posts/${postId}/like`,
    method: 'post'
  });
};

export const getComments = (postId: number) => {
  return request<Comment[]>({
    url: `/api/posts/${postId}/comments`,
    method: 'get'
  });
};

export const createComment = (data: CreateCommentData) => {
  return request<Comment>({
    url: `/api/posts/${data.postId}/comments`,
    method: 'post',
    data: { content: data.content, isAnonymous: data.isAnonymous }
  });
};

export const likeComment = (commentId: number) => {
  return request<{ like_count: number; liked: boolean }>({
    url: `/api/posts/comments/${commentId}/like`,
    method: 'post'
  });
};

export const getPendingPosts = (page = 1, pageSize = 10) => {
  return request<Post[]>({
    url: '/api/posts/admin/pending',
    method: 'get',
    params: { page, pageSize }
  });
};

export const auditPost = (postId: number, data: { status: number; audit_remark?: string }) => {
  return request<Post>({
    url: `/api/posts/admin/audit/${postId}`,
    method: 'post',
    data
  });
};
