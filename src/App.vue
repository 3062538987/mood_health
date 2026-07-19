<template>
  <div
    id="app"
    :class="{ 'has-mobile-tabs': !isAuthPage }"
    :style="{ '--theme-color': themeColor }"
  >
    <!-- 全局导航栏 -->
    <nav v-if="!isAuthPage" class="main-nav">
      <div class="nav-container">
        <div class="nav-links">
          <router-link to="/" active-class="active"> <i class="fas fa-home"></i> 首页 </router-link>
          <router-link to="/mood" active-class="active">
            <i class="fas fa-smile"></i> 情绪
          </router-link>

          <router-link v-if="featureFlags.nonCoreModules" to="/relax" active-class="active">
            <i class="fas fa-leaf"></i> 放松
          </router-link>
          <router-link to="/improve" active-class="active">
            <i class="fas fa-chart-line"></i> 提升
          </router-link>
          <router-link to="/counseling" active-class="active">
            <i class="fas fa-heart"></i> 咨询
          </router-link>
          <a
            v-if="userStore.isLoggedIn"
            href="#"
            class="nav-agent-link"
            @click.prevent="openAgentAssistant"
          >
            <i class="fas fa-robot"></i> AI 知识助手
          </a>
          <router-link to="/user" active-class="active">
            <i class="fas fa-user"></i> 我的
          </router-link>
          <router-link v-if="userStore.isAdmin" to="/admin" active-class="active">
            <i class="fas fa-user-shield"></i> 管理后台
          </router-link>
        </div>
        <div class="nav-user">
          <template v-if="userStore.isLoggedIn">
            <span class="username">{{ userStore.username }}</span>
            <button class="btn-logout" @click="handleLogout">
              <i class="fas fa-sign-out-alt"></i> 退出
            </button>
          </template>
          <template v-else>
            <router-link to="/login" class="login-btn">
              <i class="fas fa-sign-in-alt"></i> 登录
            </router-link>
            <router-link to="/register" class="register-btn">
              <i class="fas fa-user-plus"></i> 注册
            </router-link>
          </template>
        </div>
      </div>
    </nav>
    <!-- 路由出口 -->
    <main class="app-content">
      <router-view v-slot="{ Component, route }">
        <transition :name="getTransitionName(route)" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
    <!-- 全局页脚 -->
    <footer v-if="!isAuthPage">© 2025 情绪健康平台 版权所有</footer>
    <nav v-if="!isAuthPage" class="mobile-tab-bar" aria-label="移动端主导航">
      <router-link to="/" class="tab-item" active-class="active" end>
        <i class="fas fa-home"></i>
        <span>首页</span>
      </router-link>
      <router-link to="/mood" class="tab-item" active-class="active">
        <i class="fas fa-smile"></i>
        <span>情绪</span>
      </router-link>
      <router-link v-if="featureFlags.nonCoreModules" to="/relax" class="tab-item" active-class="active">
        <i class="fas fa-leaf"></i>
        <span>放松</span>
      </router-link>
      <router-link to="/improve" class="tab-item" active-class="active">
        <i class="fas fa-chart-line"></i>
        <span>提升</span>
      </router-link>
      <div class="mobile-more-wrapper">
        <button
          ref="moreButtonRef"
          type="button"
          class="tab-item mobile-more-button"
          :class="{ active: isMoreSectionActive || isMoreMenuOpen }"
          aria-haspopup="menu"
          aria-controls="mobile-more-menu"
          :aria-expanded="isMoreMenuOpen"
          @click.stop="toggleMoreMenu"
          @keydown.esc.prevent.stop="closeMoreMenu(true)"
        >
          <i class="fas fa-ellipsis-h"></i>
          <span>更多</span>
        </button>
        <div
          v-if="isMoreMenuOpen"
          id="mobile-more-menu"
          class="mobile-more-menu"
          role="menu"
          aria-label="更多导航"
          @click.stop
          @keydown.esc.prevent.stop="closeMoreMenu(true)"
        >
          <router-link to="/user" class="mobile-more-menu-item" role="menuitem" @click="closeMoreMenu()">
            <i class="fas fa-user"></i>
            <span>我的</span>
          </router-link>
          <router-link to="/counseling" class="mobile-more-menu-item" role="menuitem" @click="closeMoreMenu()">
            <i class="fas fa-heart"></i>
            <span>咨询</span>
          </router-link>
          <a
            v-if="userStore.isLoggedIn"
            class="mobile-more-menu-item"
            role="menuitem"
            @click.prevent="closeMoreMenu(); openAgentAssistant()"
          >
            <i class="fas fa-robot"></i>
            <span>AI 知识助手</span>
          </a>
          <router-link
            v-if="userStore.isAdmin"
            to="/admin"
            class="mobile-more-menu-item"
            role="menuitem"
            @click="closeMoreMenu()"
          >
            <i class="fas fa-user-shield"></i>
            <span>管理后台</span>
          </router-link>
        </div>
      </div>
    </nav>
    <!-- 成就通知 -->
    <AchievementNotification v-if="featureFlags.nonCoreModules" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useMoodStore } from '@/stores/moodStore'
import AchievementNotification from '@/components/shared/AchievementNotification.vue'
import { featureFlags } from '@/config/featureFlags'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const moodStore = useMoodStore()
const isMoreMenuOpen = ref(false)
const moreButtonRef = ref<HTMLButtonElement | null>(null)

// 判断当前是否是登录/注册页面
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/register'
})

// 计算主题颜色
const themeColor = computed(() => {
  const avg = moodStore.recentAvgIntensity
  if (avg < 3) return 'var(--mood-theme-low)'
  if (avg < 6) return 'var(--mood-theme-calm)'
  return 'var(--mood-theme-high)'
})

const isMoreSectionActive = computed(() => route.path.startsWith('/user') || route.path.startsWith('/admin'))

const getTransitionName = (route: ReturnType<typeof useRoute>) => {
  const authPaths = ['/login', '/register']
  if (authPaths.includes(route.path)) {
    return 'slide-up'
  }
  const modalPaths = ['/user/profile', '/admin']
  if (modalPaths.some(p => route.path.startsWith(p))) {
    return 'fade-scale'
  }
  return 'fade-slide'
}

const closeMoreMenu = async (restoreFocus = false) => {
  isMoreMenuOpen.value = false

  if (restoreFocus) {
    await nextTick()
    moreButtonRef.value?.focus()
  }
}

const toggleMoreMenu = () => {
  isMoreMenuOpen.value = !isMoreMenuOpen.value
}

const handleDocumentClick = () => {
  if (isMoreMenuOpen.value) {
    closeMoreMenu()
  }
}

// 退出登录
const handleLogout = async () => {
  if (userStore.logoutInProgress) return
  try {
    await userStore.logout()
  } catch {
    // 退出已由 store 处理
  }
  router.push('/login')
}

// 打开 AI 知识助手（Streamlit）
const openAgentAssistant = () => {
  const userId = userStore.user?.id || 1
  window.open(`http://localhost:8501/?user_id=${userId}`, '_blank')
}

// 组件挂载时获取情绪数据
onMounted(() => {
  document.addEventListener('click', handleDocumentClick)

  if (userStore.isLoggedIn) {
    // 当用户登录时，获取最近的情绪记录
    moodStore.fetchMoodList({ page: 1, size: 10 })
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(
  () => route.path,
  () => {
    closeMoreMenu()
  }
)
</script>

<style scoped lang="scss">
/* ── 顶部导航栏 ── */
.main-nav {
  background: rgba(255, 253, 249, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 1px 0 var(--border-color), var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (prefers-color-scheme: dark) {
    background: rgba(42, 37, 32, 0.9);
  }
}

.app-content {
  min-height: calc(100vh - 70px);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;

  a {
    color: var(--text-light-color);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.95rem;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-md);
    position: relative;
    transition: all 0.25s ease;
    display: flex;
    align-items: center;
    gap: 0.4rem;

    i {
      font-size: 1rem;
      opacity: 0.7;
      transition: opacity 0.25s ease;
    }

    &:hover {
      color: var(--primary-color);
      background: var(--primary-soft);
      i { opacity: 1; }
    }

    &.active {
      color: var(--primary-color);
      font-weight: 600;
      background: var(--primary-soft);
      i { opacity: 1; }
    }
  }
}

.nav-agent-link {
  color: var(--text-light-color);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;

  i {
    font-size: 1rem;
    opacity: 0.7;
    transition: opacity 0.25s ease;
  }

  &:hover {
    color: var(--primary-color);
    background: var(--primary-soft);
    i { opacity: 1; }
  }
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .username {
    color: var(--primary-color);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .login-btn,
  .register-btn,
  .btn-logout {
    padding: 0.45rem 1rem;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.25s ease;
    border: none;
    cursor: pointer;
  }

  .login-btn {
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    color: #fff;
    box-shadow: 0 2px 8px rgba(232, 131, 74, 0.2);
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(232, 131, 74, 0.3); }
  }

  .register-btn {
    background: var(--surface);
    color: var(--primary-color);
    border: 1.5px solid var(--primary-color);
    &:hover { background: var(--primary-soft); }
  }

  .btn-logout {
    background: transparent;
    color: var(--text-light-color);
    border: 1.5px solid var(--border-color);
    &:hover { color: var(--danger-color); border-color: var(--danger-color); }
  }
}

footer {
  text-align: center;
  padding: 20px 0;
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 20px;
}

.mobile-tab-bar { display: none; }

/* ── 路由切换动画 ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .has-mobile-tabs .app-content {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }
  .nav-container { padding: 0 1rem; }
  .main-nav { display: none; }

  .mobile-tab-bar {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 120;
    padding: 8px 10px;
    border-radius: 20px;
    background: rgba(255, 253, 249, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(180, 140, 100, 0.16);
    border: 1px solid rgba(232, 221, 208, 0.6);

    @media (prefers-color-scheme: dark) {
      background: rgba(42, 37, 32, 0.92);
      border-color: rgba(61, 54, 48, 0.6);
    }

    .tab-item {
      min-height: 44px;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 3px;
      color: var(--text-light-color);
      text-decoration: none;
      font-size: 10px;
      font-weight: 600;
      border: 0;
      background: transparent;
      cursor: pointer;
      font-family: inherit;

      i { font-size: 18px; color: var(--text-muted); transition: color 0.25s; }
      &.active { color: var(--primary-color); i { color: var(--primary-color); } }

      &:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 3px;
        border-radius: 14px;
      }
    }

    .mobile-more-wrapper {
      position: relative;
      display: grid;
      min-width: 0;
    }

    .mobile-more-menu {
      position: absolute;
      right: 0;
      bottom: calc(100% + 10px);
      min-width: 148px;
      padding: 8px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-lg);
      display: grid;
      gap: 4px;
    }

    .mobile-more-menu-item {
      min-height: 44px;
      padding: 0 12px;
      border-radius: 12px;
      color: var(--text-color);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;

      i { width: 18px; color: var(--primary-color); }
      &:hover,
      &:focus-visible { background: var(--primary-soft); outline: 3px solid var(--focus); outline-offset: 2px; }
    }
  }

  .nav-links { gap: 1rem; a { font-size: 0.9rem; i { font-size: 0.9rem; } } }
  .nav-user { gap: 0.5rem; .login-btn, .register-btn, .btn-logout { padding: 0.35rem 0.7rem; font-size: 0.8rem; } }
  footer { padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
}
</style>
