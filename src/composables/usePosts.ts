import { ref } from 'vue';
import { getPostList, createPost, getPostDetail, likePost } from '@/api/post';
import type { Post, CreatePostData } from '@/types/post';

/**
 * 帖子相关的组合式函数
 * 提供帖子列表、创建帖子、获取帖子详情、点赞等功能
 * @returns 帖子相关的状态和方法
 */
export function usePosts() {
  /** 帖子列表 */
  const posts = ref<Post[]>([]);
  /** 当前页码 */
  const currentPage = ref(1);
  /** 每页条数 */
  const pageSize = ref(10);
  /** 总记录数 */
  const total = ref(0);
  /** 加载状态 */
  const loading = ref(false);
  /** 错误信息 */
  const error = ref<string | null>(null);

  /**
   * 加载帖子列表
   * @param page 页码（可选，默认使用当前页码）
   * @param size 每页条数（可选，默认使用当前每页条数）
   */
  const loadPosts = async (page?: number, size?: number) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await getPostList(page || currentPage.value, size || pageSize.value);
      posts.value = res.list;
      total.value = res.total;
      if (page) currentPage.value = page;
      if (size) pageSize.value = size;
    } catch (err) {
      error.value = '加载帖子失败';
      console.error('加载帖子失败', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 创建帖子
   * @param post 帖子数据
   * @returns 是否创建成功
   */
  const createNewPost = async (post: CreatePostData): Promise<boolean> => {
    loading.value = true;
    error.value = null;
    try {
      await createPost(post);
      return true;
    } catch (err) {
      error.value = '发布失败';
      console.error('发布失败', err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取帖子详情
   * @param postId 帖子ID
   * @returns 帖子详情，失败返回null
   */
  const getPost = async (postId: number): Promise<Post | null> => {
    loading.value = true;
    error.value = null;
    try {
      const res = await getPostDetail(postId);
      return res;
    } catch (err) {
      error.value = '加载帖子详情失败';
      console.error('加载帖子详情失败', err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 点赞帖子
   * @param postId 帖子ID
   * @returns 点赞后的点赞数，失败返回null
   */
  const likePostById = async (postId: number): Promise<number | null> => {
    loading.value = true;
    error.value = null;
    try {
      const res = await likePost(postId);
      return res.like_count;
    } catch (err) {
      error.value = '点赞失败';
      console.error('点赞失败', err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  return {
    /** 帖子列表 */
    posts,
    /** 当前页码 */
    currentPage,
    /** 每页条数 */
    pageSize,
    /** 总记录数 */
    total,
    /** 加载状态 */
    loading,
    /** 错误信息 */
    error,
    /** 加载帖子列表方法 */
    loadPosts,
    /** 创建帖子方法 */
    createNewPost,
    /** 获取帖子详情方法 */
    getPost,
    /** 点赞帖子方法 */
    likePostById
  };
}
