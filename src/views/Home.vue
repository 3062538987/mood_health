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
        <router-link to="/relax" class="feature-card">
          <i class="fas fa-headphones"></i>
          <h3>放松中心</h3>
          <p>多种放松方式，释放压力</p>
        </router-link>
        <router-link to="/improve" class="feature-card">
          <i class="fas fa-users"></i>
          <h3>提升计划</h3>
          <p>专业团体活动，共同成长</p>
        </router-link>
        <router-link to="/user" class="feature-card">
          <i class="fas fa-user"></i>
          <h3>个人中心</h3>
          <p>管理个人资料和设置</p>
        </router-link>
      </div>

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
import { onMounted, ref } from "vue";

const isLoaded = ref(false);

onMounted(() => {
  // 添加页面加载动画
  setTimeout(() => {
    isLoaded.value = true;
  }, 300);
});
</script>

<style scoped lang="scss">
// 全局样式变量
$primary-color: #42b983;
$secondary-color: #667eea;
$accent-color: #f093fb;
$dark-color: #2c3e50;
$light-color: #ecf0f1;
$text-color: #34495e;
$text-light: #7f8c8d;

// 动画定义
@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  padding-bottom: 80px;

  // 背景装饰元素
  .background-decoration {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;

    .circle {
      position: absolute;
      border-radius: 50%;
      opacity: 0.1;
      animation: float 6s ease-in-out infinite;
    }

    .circle-1 {
      width: 300px;
      height: 300px;
      background: #42b983;
      top: -100px;
      left: -100px;
      animation-delay: 0s;
    }

    .circle-2 {
      width: 200px;
      height: 200px;
      background: #f093fb;
      top: 20%;
      right: 5%;
      animation-delay: 2s;
    }

    .circle-3 {
      width: 150px;
      height: 150px;
      background: #42b983;
      bottom: 10%;
      left: 10%;
      animation-delay: 4s;
    }

    .wave {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 200%;
      height: 100px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50% 50% 0 0;
      animation: pulse 4s ease-in-out infinite;
    }

    .wave-1 {
      height: 100px;
      animation-delay: 0s;
    }

    .wave-2 {
      height: 80px;
      animation-delay: 2s;
    }
  }
}

.home-header {
  padding: 80px 0 60px;
  text-align: center;
  position: relative;
  z-index: 1;

  .header-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .main-title {
    font-size: 48px;
    font-weight: bold;
    color: white;
    margin-bottom: 20px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    letter-spacing: 2px;

    @media (max-width: 768px) {
      font-size: 36px;
    }
  }

  .subtitle {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 300;
    letter-spacing: 1px;

    @media (max-width: 768px) {
      font-size: 16px;
    }
  }
}

.home-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  position: relative;
  z-index: 1;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto 80px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.feature-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2rem 1rem;
  text-align: center;
  text-decoration: none;
  color: #4a4a4a;
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.3s,
    box-shadow 0.3s;
  animation: fadeInUp 0.6s ease both;

  @media (prefers-color-scheme: dark) {
    background: rgba(40, 45, 52, 0.95);
    color: #e0e0e0;
  }

  i {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: inherit;
  }

  p {
    font-size: 0.9rem;
    color: #7d7d7d;
    line-height: 1.5;

    @media (prefers-color-scheme: dark) {
      color: #a0a0a0;
    }
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-md);
  }

  &:nth-child(1) {
    animation-delay: 0.1s;
  }
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.3s;
  }
  &:nth-child(4) {
    animation-delay: 0.4s;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 特色服务 section
.feature-section {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 60px 40px;
  margin-bottom: 60px;
  box-shadow: var(--shadow-sm);
  text-align: center;

  @media (prefers-color-scheme: dark) {
    background: rgba(30, 34, 40, 0.95);
  }

  @media (max-width: 768px) {
    padding: 40px 20px;
  }

  .section-title {
    font-size: 32px;
    font-weight: bold;
    color: var(--text-color);
    margin-bottom: 40px;
    position: relative;

    &::after {
      content: "";
      position: absolute;
      bottom: -15px;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 4px;
      background: linear-gradient(
        90deg,
        var(--primary-color),
        var(--secondary-color)
      );
      border-radius: 2px;
    }
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 40px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 30px;
    }

    .feature-item {
      padding: 30px 20px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 12px;
      transition: all 0.3s ease;

      @media (prefers-color-scheme: dark) {
        background: rgba(50, 55, 62, 0.5);
      }

      &:hover {
        background: rgba(255, 255, 255, 0.8);
        transform: translateY(-10px);

        @media (prefers-color-scheme: dark) {
          background: rgba(60, 65, 72, 0.8);
        }
      }

      .feature-icon {
        font-size: 48px;
        margin-bottom: 20px;
        animation: float 3s ease-in-out infinite;
        color: var(--primary-color);
      }

      h3 {
        font-size: 20px;
        font-weight: bold;
        color: var(--text-color);
        margin-bottom: 12px;
      }

      p {
        font-size: 14px;
        color: var(--text-light-color);
        line-height: 1.6;
      }
    }
  }
}

// 页脚
.home-footer {
  text-align: center;
  padding: 20px 0;
  position: relative;
  z-index: 1;

  p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: 300;
  }
}
</style>
