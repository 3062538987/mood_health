<template>
  <div class="post-list">
    <div v-for="post in posts" :key="post.id" class="post-card card">
      <div class="post-content" @click="goToDetail(post.id)">
        <h3>{{ post.title }}</h3>
        <p>{{ post.content.slice(0, 100) }}...</p>
        <div class="post-meta">
          <span>发布者：{{ post.isAnonymous ? '匿名' : post.username }}</span>
          <span>{{ formatDate(post.createdAt) }}</span>
        </div>
      </div>
      <div class="post-stats">
        <button class="stat-btn" :class="{ active: post.liked }" @click.stop="handleLike(post)">
          <span :class="post.liked ? 'fas fa-heart' : 'far fa-heart'"></span>
          {{ post.likes }}
        </button>
        <span class="stat-btn">
          <i class="far fa-comment"></i>
          {{ post.commentCount || 0 }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Post } from '@/types/post'
import { likePost } from '@/api/post'

const props = defineProps<{
  posts: Post[]
}>()

const emit = defineEmits<{
  (e: 'view-detail', postId: number): void
  (e: 'like-updated', postId: number, likes: number, liked: boolean): void
}>()

const goToDetail = (postId: number) => {
  emit('view-detail', postId)
}

const handleLike = async (post: Post) => {
  try {
    const res = await likePost(post.id)
    const newLikes = res.like_count
    const newLiked = res.liked
    emit('like-updated', post.id, newLikes, newLiked)
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.post-card {
  margin-bottom: 16px;
  background-color: $white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: $shadow-sm;
  transition: all 0.3s;
  &:hover {
    box-shadow: $shadow-md;
  }
  .post-content {
    cursor: pointer;
    h3 {
      color: $text-color;
      margin-bottom: 8px;
    }
    p {
      color: $text-light-color;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .post-meta {
      font-size: $font-size-sm;
      color: $text-light-color;
      display: flex;
      gap: 16px;
    }
  }
  .post-stats {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
    .stat-btn {
      background: none;
      border: none;
      color: $text-light-color;
      font-size: $font-size-sm;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.3s;
      i {
        font-size: 1rem;
      }
      &:hover {
        background: #f5f5f5;
        color: $primary-color;
      }
      &.active {
        color: #e74c3c;
        .far.fa-heart {
          color: #e74c3c;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .post-card {
    padding: 12px;
  }
  h3 {
    font-size: $font-size-md;
  }
  p {
    font-size: $font-size-sm;
  }
  .post-meta {
    font-size: $font-size-sm;
    gap: 12px;
  }
  .post-stats {
    gap: 12px;
  }
}
</style>
