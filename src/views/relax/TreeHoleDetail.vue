<template>
  <div v-if="post" class="post-detail">
    <h1>{{ post.title }}</h1>
    <div class="meta">
      <span>发布者：{{ post.isAnonymous ? '匿名' : post.username || '用户' }}</span>
      <span>{{ formatDate(post.createdAt) }}</span>
    </div>
    <div class="content">{{ post.content }}</div>
    <div class="actions">
      <button class="like-btn" :class="{ active: post.liked }" @click="handleLike">
        <span :class="post.liked ? 'fas fa-heart' : 'far fa-heart'"></span>
        {{ post.likes }}
      </button>
    </div>

    <!-- AI 温柔回复 -->
    <div class="ai-reply" v-if="aiReply">
      <div class="ai-reply-header">
        <span class="ai-reply-badge">树洞的回复</span>
        <span class="ai-reply-icon">💚</span>
      </div>
      <div class="ai-reply-content">{{ aiReply.content }}</div>
    </div>

    <!-- AI 回复加载中 -->
    <div class="ai-reply loading" v-if="aiReplyLoading">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <p>树洞正在思考温柔的回复...</p>
    </div>

    <!-- 生成 AI 回复按钮 -->
    <button class="generate-ai-btn" v-if="!aiReply && !aiReplyLoading" @click="generateAiReply">
      ✨ 生成 AI 温柔回复
    </button>

    <!-- 评论列表 -->
    <CommentList
      :comments="comments"
      :post-id="postId"
      @submit-comment="handleSubmitComment"
      @comment-updated="handleCommentUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import CommentList from '@/components/treehole/CommentList.vue'
import { usePosts } from '@/composables/usePosts'
import { useComments } from '@/composables/useComments'
import { getAiReply, generateAiReply as generateAiReplyApi } from '@/api/post'
import type { Post, AiReply } from '@/types/post'

const route = useRoute()
const postId = Number(route.params.id)
const post = ref<Post | null>(null)
const aiReply = ref<AiReply | null>(null)
const aiReplyLoading = ref(false)

const { getPost, likePostById } = usePosts()
const { comments, loadComments, createNewComment } = useComments()

const loadDetail = async () => {
  const postData = await getPost(postId)
  if (postData) {
    post.value = postData
    if (postData.aiReply) {
      aiReply.value = postData.aiReply
    }
    await loadComments(postId)
  }
}

const fetchAiReply = async () => {
  // 如果帖子详情已包含 AI 回复，无需再请求
  if (aiReply.value) return
  try {
    const res = await getAiReply(postId)
    if (res) {
      aiReply.value = res
    }
  } catch {
    // 没有 AI 回复，显示生成按钮
  }
}

const generateAiReply = async () => {
  aiReplyLoading.value = true
  try {
    const res = await generateAiReplyApi(postId)
    aiReply.value = res
  } catch {
    // 失败
  } finally {
    aiReplyLoading.value = false
  }
}

const handleLike = async () => {
  const likes = await likePostById(postId)
  if (likes !== null && post.value) {
    post.value.likes = likes
    post.value.liked = !post.value.liked
  }
}

const handleSubmitComment = async (content: string, isAnonymous: boolean) => {
  const success = await createNewComment(postId, content, isAnonymous)
  if (success) {
    await loadComments(postId)
  }
}

const handleCommentUpdated = (commentId: number, likes: number, liked: boolean) => {
  const comment = comments.value.find((c) => c.id === commentId)
  if (comment) {
    comment.like_count = likes
    comment.liked = liked
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

onMounted(async () => {
  await loadDetail()
  await fetchAiReply()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.post-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: $bg-color;
}

h1 {
  font-size: $font-size-xl;
  color: $text-color;
  margin-bottom: 20px;
}

.meta {
  display: flex;
  gap: 20px;
  font-size: $font-size-md;
  color: $text-light-color;
  margin-bottom: 20px;
}

.content {
  line-height: 1.6;
  color: $text-color;
  margin-bottom: 30px;
  white-space: pre-wrap;
  background-color: $white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: $shadow-sm;
}

.actions {
  margin-bottom: 30px;
}

.like-btn {
  background: $white;
  border: 1px solid $text-light-color;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: $font-size-md;
  color: $text-color;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background-color: #f5f5f5;
    border-color: #e74c3c;
    color: #e74c3c;
  }

  &.active {
    background-color: #ffeef0;
    border-color: #e74c3c;
    color: #e74c3c;
  }
}

.ai-reply {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #fef9f0 0%, #fdf2f8 100%);
  border-radius: 16px;
  border: 1px solid #fce4d6;
  margin-bottom: 20px;
}

.ai-reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ai-reply-badge {
  font-size: 13px;
  color: #e8875b;
  font-weight: 500;
}

.ai-reply-icon {
  font-size: 18px;
}

.ai-reply-content {
  font-size: 15px;
  line-height: 1.8;
  color: #555;
  white-space: pre-wrap;
}

.ai-reply.loading {
  text-align: center;
  padding: 30px 20px;
}

.loading-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: #e8875b;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.loading-dots + p {
  font-size: 13px;
  color: #999;
}

.generate-ai-btn {
  margin-top: 16px;
  margin-bottom: 20px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #fef9f0 0%, #fdf2f8 100%);
  border: 1px solid #fce4d6;
  border-radius: 24px;
  font-size: 14px;
  color: #e8875b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, #fce4d6 0%, #fce4d6 100%);
  }
}

@media (max-width: 768px) {
  .post-detail {
    padding: 10px;
  }

  h1 {
    font-size: $font-size-lg;
  }

  .meta {
    flex-direction: column;
    gap: 8px;
  }

  .content {
    padding: 12px;
  }

  .like-btn {
    padding: 6px 12px;
    font-size: $font-size-sm;
  }
}

@media (max-width: 480px) {
  .post-detail {
    padding: 8px;
  }

  h1 {
    font-size: $font-size-md;
  }

  .content {
    padding: 10px;
  }

  .like-btn {
    padding: 5px 10px;
    font-size: $font-size-sm;
  }
}
</style>