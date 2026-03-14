import { ref } from 'vue';
import { getComments, createComment } from '@/api/post';
import type { Comment } from '@/types/post';

/**
 * 评论相关的组合式函数
 * 提供评论列表、创建评论等功能
 * @returns 评论相关的状态和方法
 */
export function useComments() {
  /** 评论列表 */
  const comments = ref<Comment[]>([]);
  /** 加载状态 */
  const loading = ref(false);
  /** 错误信息 */
  const error = ref<string | null>(null);

  /**
   * 加载评论列表
   * @param postId 帖子ID
   */
  const loadComments = async (postId: number) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await getComments(postId);
      comments.value = res;
    } catch (err) {
      error.value = '加载评论失败';
      console.error('加载评论失败', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 创建评论
   * @param postId 帖子ID
   * @param content 评论内容
   * @param isAnonymous 是否匿名
   * @returns 是否创建成功
   */
  const createNewComment = async (postId: number, content: string, isAnonymous: boolean): Promise<boolean> => {
    loading.value = true;
    error.value = null;
    try {
      await createComment({ postId, content, isAnonymous });
      return true;
    } catch (err) {
      error.value = '评论失败';
      console.error('评论失败', err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    /** 评论列表 */
    comments,
    /** 加载状态 */
    loading,
    /** 错误信息 */
    error,
    /** 加载评论列表方法 */
    loadComments,
    /** 创建评论方法 */
    createNewComment
  };
}
