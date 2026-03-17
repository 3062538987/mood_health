<template>
  <div class="tree-hole">
    <!-- 发帖表单 -->
    <PostForm @submit="handleSubmitPost" />

    <!-- 工具栏 -->
    <div class="toolbar">
      <button class="refresh-btn" @click="refreshPosts">
        <i class="fas fa-redo"></i> 刷新
      </button>
    </div>

    <!-- 帖子列表 -->
    <PostList
      :posts="posts"
      @view-detail="goToDetail"
      @like-updated="handleLikeUpdated"
    />

    <!-- 分页 -->
    <div class="pagination">
      <button @click="changePage(currentPage - 1)" :disabled="currentPage <= 1">
        上一页
      </button>
      <span>第 {{ currentPage }} 页</span>
      <button
        @click="changePage(currentPage + 1)"
        :disabled="posts.length < pageSize"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import PostForm from "@/components/treehole/PostForm.vue";
import PostList from "@/components/treehole/PostList.vue";
import { usePosts } from "@/composables/usePosts";
import type { CreatePostData } from "@/types/post";

const router = useRouter();
const { posts, currentPage, pageSize, loadPosts, createNewPost } = usePosts();

const handleSubmitPost = async (post: CreatePostData) => {
  const success = await createNewPost(post);
  if (success) {
    ElMessage.success("发布成功，等待审核通过后显示");
    await loadPosts();
  } else {
    ElMessage.error("发布失败，请稍后重试");
  }
};

const goToDetail = (postId: number) => {
  router.push(`/relax/treehole/${postId}`);
};

const changePage = async (page: number) => {
  if (page < 1) return;
  await loadPosts(page);
};

const refreshPosts = async () => {
  await loadPosts(currentPage.value);
};

const handleLikeUpdated = (postId: number, likes: number, liked: boolean) => {
  const post = posts.value.find((p) => p.id === postId);
  if (post) {
    post.likes = likes;
    post.liked = liked;
  }
};

onMounted(loadPosts);
</script>

<style scoped lang="scss">
@use "@/assets/styles/theme.scss" as *;

.tree-hole {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: $bg-color;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  .refresh-btn {
    padding: 8px 16px;
    background-color: $white;
    border: 1px solid $text-light-color;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
    i {
      font-size: 0.9rem;
    }
    &:hover {
      background-color: $primary-color;
      color: $white;
      border-color: $primary-color;
    }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 30px;
  button {
    padding: 6px 12px;
    background-color: $white;
    border: 1px solid $text-light-color;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    &:hover:not(:disabled) {
      background-color: $primary-color;
      color: $white;
      border-color: $primary-color;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

@media (max-width: 768px) {
  .tree-hole {
    padding: 10px;
  }
  .pagination {
    gap: 8px;
    button {
      padding: 4px 8px;
      font-size: $font-size-sm;
    }
  }
}

@media (max-width: 480px) {
  .tree-hole {
    padding: 8px;
  }
  .pagination {
    flex-wrap: wrap;
  }
}
</style>
