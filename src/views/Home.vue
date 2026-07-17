<template>
  <div class="home-container">
    <!-- 背景装饰元素 -->
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
      <div class="wave wave-1"></div>
      <div class="wave wave-2"></div>
    </div>

    <header class="home-header">
      <div class="header-content">
        <h1 class="main-title">情绪健康管理平台</h1>
        <p class="subtitle">记录情绪 · 释放压力 · 拥抱生活</p>
      </div>
    </header>

    <main class="home-content">
      <div class="feature-grid">
        <router-link to="/mood" class="feature-card">
          <i class="fas fa-pencil-alt"></i>
          <h3>情绪管理</h3>
          <p>记录与分析你的情绪</p>
        </router-link>
        <!-- 第二版隐藏，待开发完成取消注释 <router-link to="/relax" class="feature-card">
          <i class="fas fa-headphones"></i>
          <h3>放松中心</h3>
          <p>多种放松方式，释放压力</p>
        </router-link> -->
        <!-- 第二版隐藏，待开发完成取消注释 <router-link to="/improve" class="feature-card">
          <i class="fas fa-users"></i>
          <h3>提升计划</h3>
          <p>专业团体活动，共同成长</p>
        </router-link> -->
        <router-link to="/user" class="feature-card">
          <i class="fas fa-user"></i>
          <h3>个人中心</h3>
          <p>管理个人资料和设置</p>
        </router-link>
        <router-link v-if="isAdmin" to="/admin" class="feature-card">
          <i class="fas fa-shield-alt"></i>
          <h3>管理后台</h3>
          <p>审核内容与管理平台配置</p>
        </router-link>
      </div>

      <section
        v-if="showFirstRecordOnboarding"
        class="first-record-onboarding"
        aria-labelledby="first-record-title"
      >
        <div class="onboarding-copy">
          <p class="onboarding-eyebrow">开始记录</p>
          <h2 id="first-record-title">从第一条情绪开始了解自己</h2>
          <p>你还没有情绪记录。先写下一件今天真实发生的小事，后续趋势才会更准确。</p>
        </div>
        <router-link to="/mood/record" class="onboarding-action">记录第一条情绪</router-link>
      </section>

      <!-- 特色服务介绍 -->
      <div class="feature-section">
        <h2 class="section-title">特色服务</h2>
        <div class="features">
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <h3>情绪分析</h3>
            <p>智能分析情绪变化趋势，提供专业建议</p>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🤝</div>
            <h3>社区支持</h3>
            <p>加入情绪支持社区，分享经验，相互鼓励</p>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🎯</div>
            <h3>个性化计划</h3>
            <p>根据情绪状态，定制专属的情绪管理计划</p>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="home-footer">
      <p>© 2026 情绪健康管理平台 | 用心呵护每一份情绪</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMoodStore } from '@/stores/moodStore'
import { useUserStore } from '@/stores/userStore'

const isLoaded = ref(false)
const userStore = useUserStore()
const moodStore = useMoodStore()
const isAdmin = computed(() => userStore.isAdmin)
const showFirstRecordOnboarding = computed(
  () =>
    userStore.isLoggedIn &&
    moodStore.hasFetchedMoodList &&
    !moodStore.loading &&
    !moodStore.error &&
    moodStore.moodRecords.length === 0
)

onMounted(() => {
  // 添加页面加载动画
  setTimeout(() => {
    isLoaded.value = true
  }, 300)
})
</script>

<style scoped lang="scss">
/* ── 日落花园首页 ── */
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-12px) rotate(1deg); }
  66% { transform: translateY(-6px) rotate(-1deg); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.06); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

.home-container {
  width: 100%;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  padding-bottom: 80px;
  background:
    radial-gradient(ellipse 90% 70% at 50% -20%, rgba(240, 184, 96, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse 60% 50% at 85% 80%, rgba(232, 131, 74, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 15% 35%, rgba(138, 171, 124, 0.06) 0%, transparent 50%),
    linear-gradient(180deg, #fef8f2 0%, #fdf2e8 40%, #fef8f2 100%);

  @media (prefers-color-scheme: dark) {
    background:
      radial-gradient(ellipse 90% 70% at 50% -20%, rgba(240, 160, 112, 0.08) 0%, transparent 55%),
      linear-gradient(180deg, #1e1b18 0%, #25211d 100%);
  }
}

/* ── 背景装饰 ── */
.background-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;

  .circle {
    position: absolute;
    border-radius: 50%;
    animation: float 8s ease-in-out infinite;
  }

  .circle-1 {
    width: 360px; height: 360px;
    background: radial-gradient(circle, rgba(240, 184, 96, 0.12) 0%, transparent 70%);
    top: -80px; left: -60px;
    animation-delay: 0s;
  }

  .circle-2 {
    width: 240px; height: 240px;
    background: radial-gradient(circle, rgba(138, 171, 124, 0.1) 0%, transparent 70%);
    top: 30%; right: -40px;
    animation-delay: 3s;
  }

  .circle-3 {
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(232, 131, 74, 0.08) 0%, transparent 70%);
    bottom: 15%; left: 10%;
    animation-delay: 5s;
  }

  .wave {
    position: absolute;
    bottom: 0; left: 0;
    width: 200%; height: 120px;
    background: rgba(240, 184, 96, 0.06);
    border-radius: 50% 50% 0 0;
    animation: glow-pulse 6s ease-in-out infinite;
  }
  .wave-1 { animation-delay: 0s; }
  .wave-2 { height: 90px; animation-delay: 3s; opacity: 0.6; }
}

/* ── 头部 ── */
.home-header {
  padding: 80px 0 50px;
  text-align: center;
  position: relative;
  z-index: 1;

  .header-content {
    max-width: 700px;
    margin: 0 auto;
  }

  .main-title {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 700;
    color: var(--text-color);
    margin-bottom: 12px;
    letter-spacing: 0.02em;
    line-height: 1.3;

    @media (max-width: 768px) { font-size: 32px; }
  }

  .subtitle {
    font-size: 18px;
    color: var(--text-light-color);
    font-weight: 400;
    letter-spacing: 0.04em;

    @media (max-width: 768px) { font-size: 15px; }
  }
}

.home-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
}

/* ── 功能卡片网格 ── */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
  max-width: 1100px;
  margin: 0 auto 60px;

  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  @media (max-width: 480px) { grid-template-columns: 1fr; }
}

.feature-grid > :is(.feature-card, a, button) {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 2rem 1.25rem;
  text-align: center;
  text-decoration: none;
  color: var(--text-color);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.6s ease both;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(240, 184, 96, 0.06) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.35s ease;
  }

  i, .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    display: block;
    transition: transform 0.35s ease;
  }

  h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
    color: var(--text-color);
  }

  p {
    font-size: 0.85rem;
    color: var(--text-light-color);
    line-height: 1.5;
  }

  &:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-md);
    border-color: rgba(232, 131, 74, 0.2);
    &::before { opacity: 1; }
    i, .feature-icon { transform: scale(1.1); }
  }

  &:nth-child(1) { animation-delay: 0.05s; i { color: var(--primary-color); } }
  &:nth-child(2) { animation-delay: 0.15s; i { color: var(--secondary-color); } }
  &:nth-child(3) { animation-delay: 0.25s; i { color: var(--accent-color); } }
  &:nth-child(4) { animation-delay: 0.35s; i { color: var(--primary-color); } }
}

/* ── 新用户引导 ── */
.first-record-onboarding {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: -20px auto 50px;
  padding: 28px 32px;
  border-radius: var(--radius-xl);
  background: var(--surface);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  animation: fadeInUp 0.5s ease 0.4s both;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    margin: 0 0 40px;
    padding: 22px;
  }
}

.onboarding-copy {
  display: grid;
  gap: 6px;

  .onboarding-eyebrow {
    margin: 0;
    color: var(--primary-color);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    color: var(--text-color);
    font-size: 22px;
    line-height: 1.35;
  }

  p {
    margin: 0;
    color: var(--text-light-color);
    line-height: 1.7;
  }
}

.onboarding-action {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 24px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 15px;
  box-shadow: 0 8px 20px rgba(232, 131, 74, 0.25);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(232, 131, 74, 0.35);
  }

  &:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 4px;
  }
}

/* ── 特色服务 ── */
.feature-section {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 56px 40px;
  margin-bottom: 50px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  text-align: center;

  @media (max-width: 768px) { padding: 36px 20px; }

  .section-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color);
    margin-bottom: 40px;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: -12px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
      border-radius: 2px;
    }
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 32px;

    @media (max-width: 768px) { grid-template-columns: 1fr; gap: 24px; }

    .feature-item {
      padding: 32px 20px;
      background: var(--surface-muted);
      border-radius: var(--radius-lg);
      transition: all 0.35s ease;
      border: 1px solid transparent;

      &:hover {
        background: var(--surface);
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
        border-color: var(--border-color);
      }

      .feature-icon { font-size: 44px; margin-bottom: 16px; }
      h3 { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-bottom: 8px; }
      p { font-size: 14px; color: var(--text-light-color); line-height: 1.6; }
    }
  }
}

/* ── 页脚 ── */
.home-footer {
  text-align: center;
  padding: 20px 0;
  position: relative;
  z-index: 1;

  p {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
  }
}
</style>
