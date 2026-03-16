<template>
  <div id="app" :style="{ '--theme-color': themeColor }">
    <!-- 全局导航栏 -->
    <nav v-if="!isAuthPage" class="main-nav">
      <div class="nav-container">
        <div class="nav-links">
          <router-link to="/" active-class="active">
            <i class="fas fa-home"></i> 首页
          </router-link>
          <router-link to="/mood" active-class="active">
            <i class="fas fa-smile"></i> 情绪
          </router-link>
          <router-link to="/relax" active-class="active">
            <i class="fas fa-leaf"></i> 放松
          </router-link>
          <router-link to="/improve" active-class="active">
            <i class="fas fa-chart-line"></i> 提升
          </router-link>
          <router-link to="/counseling" active-class="active">
            <i class="fas fa-heart"></i> 咨询
          </router-link>
          <router-link to="/user" active-class="active">
            <i class="fas fa-user"></i> 我的
          </router-link>
        </div>
        <div class="nav-user">
          <template v-if="userStore.isLoggedIn">
            <span class="username">{{ userStore.username }}</span>
            <button @click="handleLogout" class="btn-logout">
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
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <!-- 全局页脚 -->
    <footer v-if="!isAuthPage">© 2025 情绪健康平台 版权所有</footer>
    <!-- 成就通知 -->
    <AchievementNotification />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/userStore";
import { useMoodStore } from "@/stores/moodStore";
import AchievementNotification from "@/components/shared/AchievementNotification.vue";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const moodStore = useMoodStore();

// 判断当前是否是登录/注册页面
const isAuthPage = computed(() => {
  return route.path === "/login" || route.path === "/register";
});

// 计算主题颜色
const themeColor = computed(() => {
  const avg = moodStore.recentAvgIntensity;
  if (avg < 3) return "#B7A9A1"; // 低落时的柔和灰
  if (avg < 6) return "#A7C7E7"; // 平静时的淡蓝
  return "#F9D56E"; // 愉悦时的暖黄
});

// 退出登录
const handleLogout = () => {
  userStore.logout();
  router.push("/login");
};

// 组件挂载时获取情绪数据
onMounted(() => {
  if (userStore.isLoggedIn) {
    // 当用户登录时，获取最近的情绪记录
    moodStore.fetchMoodList({ page: 1, size: 10 });
  }
});
</script>

<style scoped lang="scss">
.main-nav {
  background: var(--white);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px); /* 毛玻璃效果（可选） */
  background-color: rgba(255, 255, 255, 0.9);

  @media (prefers-color-scheme: dark) {
    background-color: rgba(30, 34, 40, 0.95);
  }
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-links {
  display: flex;
  gap: 2.5rem;
  align-items: center;

  a {
    color: var(--text-color);
    text-decoration: none;
    font-weight: 500;
    font-size: 1.1rem;
    padding: 0.5rem 0;
    position: relative;
    transition: color 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    i {
      font-size: 1.2rem;
      opacity: 0.8;
      color: var(--theme-color, var(--primary-color));
    }

    &:hover {
      color: var(--theme-color, var(--primary-color));
    }

    &.active {
      color: var(--theme-color, var(--primary-color));
      font-weight: 600;

      &::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: var(--theme-color, var(--primary-color));
        border-radius: 3px 3px 0 0;
        animation: slideIn 0.2s ease;
      }
    }
  }
}

@keyframes slideIn {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 1rem;

  .username {
    color: var(--theme-color, var(--primary-color));
    font-weight: 500;
  }

  .login-btn,
  .register-btn,
  .btn-logout {
    padding: 0.5rem 1.2rem;
    border-radius: 30px;
    text-decoration: none;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.3s ease;
    border: none;
    cursor: pointer;
  }

  .login-btn {
    background: var(--theme-color, var(--primary-color));
    color: white;

    &:hover {
      background: var(--theme-color, var(--primary-color));
      opacity: 0.9;
    }
  }

  .register-btn {
    background: var(--bg-light);
    color: var(--theme-color, var(--primary-color));
    border: 1px solid var(--theme-color, var(--primary-color));

    &:hover {
      background: var(--theme-color, var(--primary-color));
      color: white;
    }
  }

  .btn-logout {
    background: transparent;
    color: #e74c3c;
    border: 1px solid #e74c3c;

    &:hover {
      background: #e74c3c;
      color: white;
    }
  }
}

footer {
  text-align: center;
  padding: 20px 0;
  color: var(--text-light-color);
  font-size: 14px;
  margin-top: 20px;
}

// 路由切换动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 响应式示例
@media (max-width: 768px) {
  .nav-container {
    padding: 0 1rem;
  }
  .nav-links {
    gap: 1.2rem;
    a {
      font-size: 1rem;
      i {
        font-size: 1rem;
      }
    }
  }
  .nav-user {
    gap: 0.5rem;
    .login-btn,
    .register-btn,
    .btn-logout {
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
    }
  }
}
</style>
