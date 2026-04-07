<template>
  <div class="layout">
    <nav class="layout-nav">
      <router-link to="/">首页</router-link>
      <router-link to="/mood/record">情绪记录</router-link>
      <router-link to="/relax/center">解压中心</router-link>
      <router-link to="/improve/group">团体辅导</router-link>
      <router-link to="/user/profile">个人中心</router-link>
      <router-link v-if="isAdmin" to="/admin">管理后台</router-link>
    </nav>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)
</script>

<style scoped lang="scss">
.layout-nav {
  display: flex;
  gap: 20px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  a {
    text-decoration: none;
    color: #333;
    &.router-link-exact-active {
      color: #42b983;
    }
  }
}
</style>
