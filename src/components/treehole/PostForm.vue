<template>
  <div class="create-post card">
    <h2>分享你的心事</h2>
    <div class="form-group">
      <input v-model="newPost.title" placeholder="标题" />
    </div>
    <div class="form-group">
      <textarea
        v-model="newPost.content"
        placeholder="内容..."
        rows="4"
      ></textarea>
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" v-model="newPost.isAnonymous" /> 匿名发布
      </label>
    </div>
    <button class="btn primary" @click="submitPost">发布</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { CreatePostData } from "@/types/post";

const newPost = ref<CreatePostData>({
  title: "",
  content: "",
  isAnonymous: false,
});

const emit = defineEmits<{
  (e: "submit", post: CreatePostData): void;
}>();

/**
 * 发布帖子
 * 验证表单并触发提交事件
 */
const submitPost = () => {
  if (!newPost.value.title.trim() || !newPost.value.content.trim()) {
    ElMessage.warning("标题和内容不能为空");
    return;
  }
  emit("submit", newPost.value);
  newPost.value = { title: "", content: "", isAnonymous: false };
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

.create-post {
  margin-bottom: 30px;
  background-color: $white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: $shadow-sm;
  h2 {
    color: $text-color;
    margin-bottom: 20px;
  }
  .form-group {
    margin-bottom: 16px;
    input,
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid $text-light-color;
      border-radius: 4px;
      font-size: $font-size-md;
      &:focus {
        outline: none;
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.2);
      }
    }
    textarea {
      resize: vertical;
      min-height: 120px;
    }
  }
  button {
    background-color: $primary-color;
    color: $white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: $font-size-md;
    transition: all 0.3s;
    &:hover {
      background-color: darken($primary-color, 10%);
    }
  }
}

@media (max-width: 768px) {
  .create-post {
    padding: 15px;
  }
  .form-group {
    margin-bottom: 12px;
    input,
    textarea {
      padding: 8px;
      font-size: $font-size-sm;
    }
  }
  button {
    padding: 8px 16px;
    font-size: $font-size-sm;
  }
}
</style>
