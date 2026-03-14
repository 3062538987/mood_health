<template>
  <div class="comments">
    <h3>评论 ({{ comments.length }})</h3>
    <div class="comment-form">
      <textarea
        v-model="newComment"
        placeholder="写下你的评论..."
        :maxlength="500"
      ></textarea>
      <div class="form-actions">
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="isAnonymous" /> 匿名评论
          </label>
          <span class="char-count">{{ newComment.length }}/500</span>
        </div>
        <button @click="submitComment" :disabled="!newComment.trim()">
          发表评论
        </button>
      </div>
    </div>
    <div v-for="comment in comments" :key="comment.id" class="comment">
      <div class="comment-header">
        <strong>{{
          comment.isAnonymous ? "匿名" : comment.username || "用户"
        }}</strong>
        <span class="time">{{ formatDate(comment.createdAt) }}</span>
      </div>
      <p>{{ comment.content }}</p>
      <div class="comment-actions">
        <button
          class="like-btn"
          :class="{ active: comment.liked }"
          @click="handleLike(comment)"
        >
          <span :class="comment.liked ? 'fas fa-heart' : 'far fa-heart'"></span>
          {{ comment.like_count || 0 }}
        </button>
      </div>
    </div>
    <div v-if="comments.length === 0" class="no-comments">
      暂无评论，快来抢沙发吧~
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { Comment } from "@/types/post";
import { likeComment } from "@/api/post";

const props = defineProps<{
  comments: Comment[];
  postId: number;
}>();

const newComment = ref("");
const isAnonymous = ref(false);

const emit = defineEmits<{
  (e: "submit-comment", content: string, isAnonymous: boolean): void;
  (
    e: "comment-updated",
    commentId: number,
    likes: number,
    liked: boolean,
  ): void;
}>();

const submitComment = () => {
  if (!newComment.value.trim()) return;
  if (newComment.value.length > 500) {
    ElMessage.warning("评论内容不能超过500字");
    return;
  }
  emit("submit-comment", newComment.value, isAnonymous.value);
  newComment.value = "";
  isAnonymous.value = false;
};

const handleLike = async (comment: Comment) => {
  try {
    const res = await likeComment(comment.id);
    emit("comment-updated", comment.id, res.like_count, res.liked);
  } catch (error) {
    console.error("点赞评论失败:", error);
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

.comments {
  margin-top: 30px;
  h3 {
    margin-bottom: 20px;
    color: $text-color;
  }
  .comment-form {
    margin-bottom: 30px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background-color: $white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: $shadow-sm;
    textarea {
      padding: 12px;
      border: 1px solid $text-light-color;
      border-radius: 4px;
      resize: vertical;
      font-size: $font-size-md;
      min-height: 100px;
      &:focus {
        outline: none;
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.2);
      }
    }
    .form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .form-group {
        display: flex;
        align-items: center;
        gap: 16px;
        .char-count {
          font-size: $font-size-sm;
          color: $text-light-color;
        }
      }
    }
    button {
      padding: 8px 20px;
      background-color: $primary-color;
      color: $white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: $font-size-md;
      transition: all 0.3s;
      &:hover:not(:disabled) {
        background-color: darken($primary-color, 10%);
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
  .comment {
    background: $white;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
    box-shadow: $shadow-sm;
    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      strong {
        color: $text-color;
      }
      .time {
        font-size: $font-size-sm;
        color: $text-light-color;
      }
    }
    p {
      margin-bottom: 8px;
      color: $text-light-color;
      line-height: 1.4;
    }
    .comment-actions {
      .like-btn {
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
        &:hover {
          background: #f5f5f5;
          color: #e74c3c;
        }
        &.active {
          color: #e74c3c;
        }
      }
    }
  }
  .no-comments {
    text-align: center;
    color: $text-light-color;
    padding: 30px;
    font-size: $font-size-md;
  }
}

@media (max-width: 768px) {
  .comment-form {
    padding: 12px;
    textarea {
      padding: 10px;
      font-size: $font-size-sm;
    }
    .form-actions {
      flex-direction: column;
      gap: 10px;
      align-items: stretch !important;
      button {
        width: 100%;
        padding: 10px;
        font-size: $font-size-sm;
      }
    }
  }
  .comment {
    padding: 12px;
  }
}
</style>
