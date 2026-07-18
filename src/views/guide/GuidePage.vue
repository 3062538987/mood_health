<template>
  <div class="guide-page">
    <div class="guide-container">
      <button class="close-btn" @click="skipGuide" aria-label="关闭引导">
        <i class="fas fa-times"></i>
      </button>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${((currentStep + 1) / steps.length) * 100}%` }"></div>
      </div>

      <div class="step-content">
        <div class="step-icon-wrapper">
          <div class="step-icon">
            <i :class="steps[currentStep].icon"></i>
          </div>
          <span class="step-number">{{ currentStep + 1 }}/{{ steps.length }}</span>
        </div>

        <h2>{{ steps[currentStep].title }}</h2>
        <p class="step-desc">{{ steps[currentStep].description }}</p>
      </div>

      <div class="step-actions">
        <button v-if="currentStep > 0" class="btn secondary" @click="prevStep">
          返回
        </button>
        <button v-if="currentStep < steps.length - 1" class="btn primary" @click="nextStep">
          下一步
        </button>
        <button v-else class="btn primary" @click="completeGuide">
          开始记录
        </button>
      </div>

      <div class="skip-link">
        <button type="button" @click="skipGuide">跳过引导，直接浏览</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const currentStep = ref(0)

const steps = [
  {
    icon: 'fas fa-smile',
    title: '记录情绪',
    description: '记录当下的情绪状态，追踪变化趋势，了解自己的情绪模式',
  },
  {
    icon: 'fas fa-shield-halved',
    title: '数据与隐私',
    description: '你的情绪数据仅用于分析，AI 分析仅供参考，不能替代专业咨询',
  },
  {
    icon: 'fas fa-rocket',
    title: '开始探索',
    description: '从记录第一条情绪开始，逐步了解自己的情绪变化规律',
  },
]

const nextStep = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const completeGuide = () => {
  localStorage.setItem('guideCompleted', 'true')
  router.push('/mood/record')
}

const skipGuide = () => {
  localStorage.setItem('guideCompleted', 'true')
  router.push('/')
}
</script>

<style scoped lang="scss">
.guide-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fef8f2 0%, #fdf2e8 40%, #fef8f2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.guide-container {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 40px;
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  position: relative;
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 16px;

  &:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  &:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
}

.progress-bar {
  height: 4px;
  background: var(--surface-muted);
  border-radius: 2px;
  margin-bottom: 32px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.step-content {
  margin-bottom: 32px;
}

.step-icon-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 24px;
}

.step-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2.5rem;
  box-shadow: 0 12px 28px rgba(232, 131, 74, 0.3);
}

.step-number {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 28px;
  height: 28px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 12px;
  font-family: var(--font-display);
}

.step-desc {
  font-size: 15px;
  color: var(--text-light-color);
  line-height: 1.7;
  margin: 0;
}

.step-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;

  &.primary {
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    color: #fff;
    box-shadow: 0 4px 14px rgba(232, 131, 74, 0.25);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(232, 131, 74, 0.35);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
  }

  &.secondary {
    background: var(--surface-muted);
    color: var(--text-color);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--border-color);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
}

.skip-link {
  button {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--text-light-color);
    }

    &:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
  }
}

@media (max-width: 640px) {
  .guide-container {
    padding: 32px 24px;
    margin-top: -40px;
  }

  h2 {
    font-size: 20px;
  }

  .step-desc {
    font-size: 14px;
  }

  .step-icon {
    width: 60px;
    height: 60px;
    font-size: 1.8rem;
  }

  .step-number {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .btn {
    padding: 11px 20px;
    font-size: 14px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}
</style>