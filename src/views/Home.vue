<template>
  <div class="home-container">
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
        <p class="subtitle">{{ greeting }}</p>
        <p class="disclaimer">本平台提供情绪记录与自我调节建议，不能替代专业心理咨询或医疗诊断</p>
      </div>
    </header>

    <main class="home-content">
      <div v-if="userStore.isLoggedIn" class="today-section">
        <div v-if="showFirstRecordOnboarding" class="today-card onboarding-card first-record-onboarding">
          <div class="card-icon-wrapper">
            <div class="card-icon">
              <i class="fas fa-pencil-alt"></i>
            </div>
          </div>
          <div class="card-content">
            <p class="card-eyebrow">开始记录</p>
            <h2>从第一条情绪开始了解自己</h2>
            <p>你还没有情绪记录。先写下一件今天真实发生的小事，后续趋势才会更准确。</p>
          </div>
          <router-link to="/mood/record" class="card-action onboarding-action">
            记录第一条情绪
          </router-link>
        </div>

        <div v-else-if="latestRecord" class="today-card mood-card">
          <div class="card-icon-wrapper">
            <div class="card-icon" :class="getMoodIconClass(latestRecord.moodType[0])">
              <i :class="getMoodIcon(latestRecord.moodType[0])"></i>
            </div>
          </div>
          <div class="card-content">
            <p class="card-eyebrow">今日状态</p>
            <h2>{{ getMoodLabel(latestRecord.moodType[0]) }}</h2>
            <p>{{ formatTimeAgo(latestRecord.createTime) }}记录 · 强度 {{ latestRecord.intensity }}/10</p>
            <p v-if="latestRecord.event" class="record-desc">{{ latestRecord.event }}</p>
          </div>
          <div class="card-actions">
            <router-link to="/mood/record" class="card-action primary">记录新情绪</router-link>
            <router-link to="/mood/analysis" class="card-action secondary">查看分析</router-link>
          </div>
        </div>

        <div v-else class="today-card empty-card">
          <div class="card-icon-wrapper">
            <div class="card-icon">
              <i class="fas fa-clock"></i>
            </div>
          </div>
          <div class="card-content">
            <p class="card-eyebrow">等待记录</p>
            <h2>今天还没有记录情绪</h2>
            <p>花一分钟记录当下的感受，了解自己的情绪变化规律</p>
          </div>
          <router-link to="/mood/record" class="card-action">记录今天的情绪</router-link>
        </div>
      </div>

      <div v-else class="welcome-section">
        <div class="welcome-card">
          <div class="welcome-icon">
            <i class="fas fa-heart"></i>
          </div>
          <h2>欢迎来到情绪健康管理平台</h2>
          <p>记录情绪变化，找到适合自己的调节方式</p>
          <div class="welcome-actions">
            <router-link to="/login" class="welcome-btn primary">登录</router-link>
            <router-link to="/register" class="welcome-btn secondary">注册</router-link>
          </div>
        </div>
      </div>

      <div v-if="userStore.isLoggedIn" class="quick-actions">
        <h3 class="section-title">快速入口</h3>
        <div class="action-grid">
          <router-link to="/mood/record" class="action-item">
            <i class="fas fa-pencil-alt"></i>
            <span>记录情绪</span>
          </router-link>
          <router-link v-if="featureFlags.nonCoreModules" to="/relax" class="action-item">
            <i class="fas fa-headphones"></i>
            <span>放松中心</span>
          </router-link>
          <router-link to="/mood/analysis" class="action-item">
            <i class="fas fa-chart-pie"></i>
            <span>情绪洞察</span>
          </router-link>
          <router-link v-if="featureFlags.nonCoreModules" to="/relax/treehole" class="action-item">
            <i class="fas fa-tree"></i>
            <span>树洞</span>
          </router-link>
          <router-link to="/improve" class="action-item">
            <i class="fas fa-users"></i>
            <span>提升计划</span>
          </router-link>
          <router-link to="/user" class="action-item">
            <i class="fas fa-user"></i>
            <span>个人中心</span>
          </router-link>
        </div>
      </div>

      <div v-if="isAdmin" class="admin-entry">
        <router-link to="/admin" class="admin-link">
          <i class="fas fa-shield-alt"></i>
          <span>管理后台</span>
        </router-link>
      </div>
    </main>

    <footer class="home-footer">
      <p>© 2026 情绪健康管理平台 | 用心呵护每一份情绪</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMoodStore } from '@/stores/moodStore'
import { useUserStore } from '@/stores/userStore'
import { featureFlags } from '@/config/featureFlags'
import type { MoodRecord } from '@/types/mood'

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

const latestRecord = computed<MoodRecord | null>(() => {
  if (!userStore.isLoggedIn || moodStore.moodRecords.length === 0) return null
  const records = [...moodStore.moodRecords].sort(
    (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  )
  return records[0] || null
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了，照顾好自己'
  if (hour < 12) return '早上好，今天也要好好的'
  if (hour < 14) return '中午好，记得休息一下'
  if (hour < 18) return '下午好，保持好心情'
  return '晚上好，放松一下吧'
})

const getMoodLabel = (moodType: string): string => {
  const map: Record<string, string> = {
    happy: '开心',
    sad: '难过',
    angry: '生气',
    anxious: '焦虑',
    calm: '平静',
    excited: '兴奋',
    tired: '疲惫',
    confused: '困惑',
    hopeful: '期待',
    grateful: '感恩',
    lonely: '孤独',
    stressed: '压力大',
  }
  return map[moodType] || moodType
}

const getMoodIcon = (moodType: string): string => {
  const map: Record<string, string> = {
    happy: 'fas fa-smile',
    sad: 'fas fa-frown',
    angry: 'fas fa-angry',
    anxious: 'fas fa-meh',
    calm: 'fas fa-smile-beam',
    excited: 'fas fa-laugh',
    tired: 'fas fa-sleep',
    confused: 'fas fa-dizzy',
    hopeful: 'fas fa-star',
    grateful: 'fas fa-heart',
    lonely: 'fas fa-user',
    stressed: 'fas fa-exclamation-triangle',
  }
  return map[moodType] || 'fas fa-smile'
}

const getMoodIconClass = (moodType: string): string => {
  const map: Record<string, string> = {
    happy: 'mood-happy',
    sad: 'mood-sad',
    angry: 'mood-angry',
    anxious: 'mood-anxious',
    calm: 'mood-calm',
    excited: 'mood-excited',
    tired: 'mood-tired',
    confused: 'mood-confused',
    hopeful: 'mood-hopeful',
    grateful: 'mood-grateful',
    lonely: 'mood-lonely',
    stressed: 'mood-stressed',
  }
  return map[moodType] || 'mood-neutral'
}

const formatTimeAgo = (dateStr: string): string => {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}
</script>

<style scoped lang="scss">
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

.home-header {
  padding: 60px 0 30px;
  text-align: center;
  position: relative;
  z-index: 1;

  .header-content {
    max-width: 700px;
    margin: 0 auto;
  }

  .main-title {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 700;
    color: var(--text-color);
    margin-bottom: 8px;
    letter-spacing: 0.02em;
    line-height: 1.3;

    @media (max-width: 768px) { font-size: 28px; }
  }

  .subtitle {
    font-size: 17px;
    color: var(--text-light-color);
    font-weight: 400;
    letter-spacing: 0.02em;

    @media (max-width: 768px) { font-size: 14px; }
  }

  .disclaimer {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 400;
    margin-top: 10px;
    line-height: 1.6;

    @media (max-width: 768px) { font-size: 11px; }
  }
}

.home-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
}

.today-section {
  margin-bottom: 40px;
}

.today-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: var(--radius-xl);
  background: var(--surface);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  animation: fadeInUp 0.5s ease both;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
  }
}

.card-icon-wrapper {
  flex-shrink: 0;
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  box-shadow: 0 8px 20px rgba(232, 131, 74, 0.25);

  &.mood-happy { background: linear-gradient(135deg, #22c55e, #16a34a); }
  &.mood-sad { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  &.mood-angry { background: linear-gradient(135deg, #ef4444, #dc2626); }
  &.mood-anxious { background: linear-gradient(135deg, #f59e0b, #d97706); }
  &.mood-calm { background: linear-gradient(135deg, #14b8a6, #0d9488); }
  &.mood-excited { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
  &.mood-tired { background: linear-gradient(135deg, #64748b, #475569); }
  &.mood-confused { background: linear-gradient(135deg, #f97316, #ea580c); }
  &.mood-hopeful { background: linear-gradient(135deg, #06b6d4, #0891b2); }
  &.mood-grateful { background: linear-gradient(135deg, #ec4899, #db2777); }
  &.mood-lonely { background: linear-gradient(135deg, #94a3b8, #64748b); }
  &.mood-stressed { background: linear-gradient(135deg, #ef4444, #f97316); }
}

.card-content {
  flex: 1;

  .card-eyebrow {
    margin: 0;
    color: var(--primary-color);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    color: var(--text-color);
    font-size: 22px;
    line-height: 1.35;
    margin-bottom: 6px;

    @media (max-width: 768px) { font-size: 19px; }
  }

  p {
    margin: 0;
    color: var(--text-light-color);
    line-height: 1.6;
    font-size: 14px;
  }

  .record-desc {
    margin-top: 8px;
    font-style: italic;
    opacity: 0.8;
  }
}

.card-action {
  flex-shrink: 0;
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

  &.secondary {
    background: var(--surface-muted);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    box-shadow: none;

    &:hover {
      background: var(--border-color);
      box-shadow: none;
    }
  }
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;

  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.welcome-section {
  margin-bottom: 40px;
}

.welcome-card {
  text-align: center;
  padding: 48px 32px;
  border-radius: var(--radius-xl);
  background: var(--surface);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  animation: fadeInUp 0.5s ease both;

  .welcome-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 32px;
    box-shadow: 0 12px 28px rgba(232, 131, 74, 0.3);
  }

  h2 {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--text-color);
    margin: 0 0 10px;
  }

  p {
    color: var(--text-light-color);
    font-size: 15px;
    margin: 0 0 28px;
    line-height: 1.6;
  }
}

.welcome-actions {
  display: flex;
  gap: 12px;
  justify-content: center;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: center;
  }
}

.welcome-btn {
  padding: 12px 32px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s ease;

  &.primary {
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    color: #fff;
    box-shadow: 0 8px 20px rgba(232, 131, 74, 0.25);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(232, 131, 74, 0.35);
    }
  }

  &.secondary {
    background: var(--surface-muted);
    color: var(--text-color);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--border-color);
    }
  }
}

.quick-actions {
  margin-bottom: 30px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 16px;
  padding-left: 4px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border-color);
  text-decoration: none;
  color: var(--text-color);
  transition: all 0.25s ease;

  i {
    font-size: 24px;
    color: var(--primary-color);
  }

  span {
    font-size: 13px;
    font-weight: 500;
    text-align: center;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-sm);
    border-color: rgba(232, 131, 74, 0.2);
  }

  &:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
}

.admin-entry {
  text-align: center;
  margin-top: 20px;
}

.admin-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  background: rgba(139, 92, 246, 0.08);
  color: #7c3aed;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(139, 92, 246, 0.2);
  transition: all 0.2s;

  &:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.3);
  }
}

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
