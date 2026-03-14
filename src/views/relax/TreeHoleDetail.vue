<template>
  <div class="post-detail" v-if="post">
    <h1>{{ post.title }}</h1>
    <div class="meta">
      <span
        >发布者：{{ post.isAnonymous ? "匿名" : post.username || "用户" }}</span
      >
      <span>{{ formatDate(post.createdAt) }}</span>
    </div>
    <div class="content">{{ post.content }}</div>
    <div class="actions">
      <button
        class="like-btn"
        :class="{ active: post.liked }"
        @click="handleLike"
      >
        <span :class="post.liked ? 'fas fa-heart' : 'far fa-heart'"></span>
        {{ post.likes }}
      </button>
    </div>

    <!-- 评论列表 -->
    <CommentList
      :comments="comments"
      :postId="postId"
      @submit-comment="handleSubmitComment"
      @comment-updated="handleCommentUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import CommentList from "@/components/treehole/CommentList.vue";
import { usePosts } from "@/composables/usePosts";
import { useComments } from "@/composables/useComments";
import type { Post } from "@/types/post";

const route = useRoute();
const postId = Number(route.params.id);
const post = ref<Post | null>(null);

const { getPost, likePostById } = usePosts();
const { comments, loadComments, createNewComment } = useComments();

const loadDetail = async () => {
  const postData = await getPost(postId);
  if (postData) {
    post.value = postData;
    await loadComments(postId);
  }
};

const handleLike = async () => {
  const likes = await likePostById(postId);
  if (likes !== null && post.value) {
    post.value.likes = likes;
    post.value.liked = !post.value.liked;
  }
};

const handleSubmitComment = async (content: string, isAnonymous: boolean) => {
  const success = await createNewComment(postId, content, isAnonymous);
  if (success) {
    await loadComments(postId);
  }
};

const handleCommentUpdated = (
  commentId: number,
  likes: number,
  liked: boolean,
) => {
  const comment = comments.value.find((c) => c.id === commentId);
  if (comment) {
    (comment as any).like_count = likes;
    (comment as any).liked = liked;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

onMounted(loadDetail);
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

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
