<template>
  <div class="admin-layout">
    <aside class="admin-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <i class="fas fa-user-shield"></i>
          <span v-if="!sidebarCollapsed" class="logo-text">管理后台</span>
        </div>
        <button
          type="button"
          class="collapse-btn"
          :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <i :class="sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in sidebarItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isNavActive(item.path) }"
          :aria-current="isNavActive(item.path) ? 'page' : undefined"
        >
          <i :class="item.icon"></i>
          <span v-if="!sidebarCollapsed" class="nav-text">{{ item.name }}</span>
          <span v-if="sidebarCollapsed" class="nav-tooltip">{{ item.name }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="footer-btn" @click="handleLogout">
          <i class="fas fa-sign-out-alt"></i>
          <span v-if="!sidebarCollapsed">退出登录</span>
        </button>
      </div>
    </aside>

    <main class="admin-content">
      <header class="admin-header">
        <div class="header-left">
          <button
            type="button"
            class="toggle-sidebar-btn"
            aria-label="切换侧边栏"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <i class="fas fa-bars"></i>
          </button>
          <div class="current-path">
            <i class="fas fa-home"></i>
            <span>{{ currentPageName }}</span>
          </div>
        </div>
        <div class="header-right">
          <span class="user-info">
            <i class="fas fa-user-circle"></i>
            {{ userStore.username }}
          </span>
          <span class="role-badge">{{ userStore.user?.role || 'admin' }}</span>
        </div>
      </header>

      <div class="admin-main">
        <router-view v-slot="{ Component }">
          <component :is="Component" class="admin-route-content" />
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteMeta } from 'vue-router'
import { requirePermission } from '@/router/guards'
import { useUserStore } from '@/stores/userStore'

type SubNavItem = NonNullable<RouteMeta['subNav']>[number]

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const sidebarCollapsed = ref(false)

const sidebarItems = computed<SubNavItem[]>(() => {
  const adminRoute = route.matched.find((record) => Array.isArray(record.meta.subNav))
  const configuredItems = adminRoute?.meta.subNav ?? []

  return configuredItems.filter((item) => {
    const resolved = router.resolve(item.path)
    const leafRoute = resolved.matched[resolved.matched.length - 1]
    if (!leafRoute || leafRoute.name === 'NotFound') {
      return false
    }

    const roles = leafRoute.meta.roles ?? []
    const currentRole = userStore.user?.role ?? 'user'
    if (roles.length > 0 && !roles.includes(currentRole)) {
      return false
    }

    return requirePermission(userStore, leafRoute.meta.permission)
  })
})

const isNavActive = (path: string) => {
  return route.path.startsWith(path)
}

const currentPageName = computed(() => {
  const item = sidebarItems.value.find((i) => route.path.startsWith(i.path))
  return item?.name || '管理后台'
})

const handleLogout = async () => {
  if (userStore.logoutInProgress) return
  try {
    await userStore.logout()
  } catch {
    // 退出已由 store 处理
  }
  router.push('/login')
}

const handleResize = () => {
  sidebarCollapsed.value = window.innerWidth < 900
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

watch(
  () => route.path,
  () => {
    if (window.innerWidth < 768) {
      sidebarCollapsed.value = true
    }
  }
)
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.admin-layout {
  display: flex;
  min-height: calc(100vh - 120px);
}

.admin-sidebar {
  width: 220px;
  background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 64px;
  bottom: 0;
  z-index: 100;
  transition: width 0.3s ease;
  overflow-y: auto;

  &.collapsed {
    width: 64px;
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;

  i {
    font-size: 20px;
    color: var(--primary-color);
  }

  .logo-text {
    white-space: nowrap;
  }
}

.collapse-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s;
  position: relative;

  i {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  .nav-text {
    white-space: nowrap;
    font-size: 14px;
  }

  .nav-tooltip {
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: #1a202c;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: all 0.2s;
    margin-left: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 1000;
  }

  &:hover {
    background: rgba(232, 131, 74, 0.2);
    color: #fff;

    .nav-tooltip {
      opacity: 1;
      visibility: visible;
    }
  }

  &.active {
    background: rgba(232, 131, 74, 0.3);
    color: var(--primary-color);
  }
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: rgba(239, 68, 68, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}

.admin-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 220px;
  transition: margin-left 0.3s ease;
  background: var(--bg-color);

  .sidebar-collapsed & {
    margin-left: 64px;
  }
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toggle-sidebar-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-soft);
  }
}

.current-path {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-light-color);

  i {
    color: var(--primary-color);
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;

  i {
    font-size: 18px;
    color: var(--primary-color);
  }
}

.role-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--primary-soft);
  color: var(--primary-color);
}

.admin-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .admin-sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;

    &.collapsed {
      transform: translateX(0);
    }
  }

  .admin-content {
    margin-left: 0;
  }

  .toggle-sidebar-btn {
    display: block;
  }
}

@media (max-width: 640px) {
  .admin-header {
    padding: 12px 16px;
  }

  .admin-main {
    padding: 16px;
  }

  .user-info span:last-child {
    display: none;
  }
}

</style>
