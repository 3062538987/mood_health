<template>
  <header class="sub-header">
    <div class="header-container">
      <div class="logo">
        <router-link to="/">
          <i class="fas fa-brain"></i> 情绪健康管理平台
        </router-link>
      </div>
      <nav class="sub-nav" v-if="subNavItems.length > 0">
        <router-link
          v-for="item in subNavItems"
          :key="item.path"
          :to="item.path"
          active-class="active"
        >
          <i :class="item.icon"></i> {{ item.name }}
        </router-link>
      </nav>
      <nav v-else class="sub-nav">
        <router-link to="/mood/record" active-class="active">
          <i class="fas fa-pencil-alt"></i> 情绪记录
        </router-link>
        <router-link to="/relax/center" active-class="active">
          <i class="fas fa-headphones"></i> 解压中心
        </router-link>
        <router-link to="/improve/group" active-class="active">
          <i class="fas fa-users"></i> 团体辅导
        </router-link>
        <router-link to="/improve/knowledge" active-class="active">
          <i class="fas fa-book-open"></i> 情绪科普
        </router-link>
      </nav>
      <div class="user-profile">
        <router-link to="/user/profile" class="profile-btn">
          <i class="fas fa-user-circle"></i> 个人中心
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface SubNavItem {
  path: string;
  name: string;
  icon: string;
}

const route = useRoute()
const subNavItems = computed<SubNavItem[]>(() => {
  // 查找当前路由匹配的父路由中第一个包含 subNav 的路由
  const matched = route.matched.find(record => record.meta?.subNav)
  return (matched?.meta?.subNav as SubNavItem[]) || []
})
</script>

<style scoped lang="scss">
.sub-header {
  background: var(--bg-light);
  border-bottom: 1px solid var(--border-color);
  padding: 0.8rem 0;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo a {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  i {
    color: var(--primary-color);
  }
}

.sub-nav {
  display: flex;
  gap: 2rem;
  a {
    color: var(--text-color);
    text-decoration: none;
    font-weight: 500;
    padding: 0.3rem 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;

    i {
      font-size: 1rem;
      color: var(--primary-color);
    }

    &:hover {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    &.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
      font-weight: 600;
    }
  }
}

.profile-btn {
  background: var(--white);
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  padding: 0.4rem 1.2rem;
  border-radius: 30px;
  text-decoration: none;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s;

  &:hover {
    background: var(--primary-color);
    color: white;
  }
}

// 响应式调整
@media (max-width: 992px) {
  .header-container {
    flex-wrap: wrap;
    gap: 1rem;
  }
  .sub-nav {
    order: 3;
    width: 100%;
    justify-content: center;
    padding-top: 0.8rem;
    border-top: 1px dashed #ccc;
  }
}

@media (max-width: 768px) {
  .header-container {
    padding: 0 1rem;
  }
  .logo a {
    font-size: 1.2rem;
  }
  .sub-nav {
    gap: 1.5rem;
    a {
      font-size: 0.9rem;
      i {
        font-size: 0.9rem;
      }
    }
  }
  .profile-btn {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .header-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .sub-nav {
    gap: 1rem;
    flex-wrap: wrap;
  }
  .user-profile {
    align-self: flex-end;
  }
}
</style>
