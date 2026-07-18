<template>
  <div class="guide-page">
    <div class="guide-container">
    <h1>欢迎使用情绪健康平台</h1>
    <p class="subtitle">记录情绪变化，找到适合自己的调节方式</p>
    <p class="disclaimer">本平台提供情绪记录与自我调节建议，不能替代专业心理咨询或医疗诊断</p>

    <div class="guide-steps">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="step"
          :class="{ clickable: step.route }"
          @click="step.route && goToStep(step.route)"
        >
          <div class="step-icon">
            <i :class="step.icon"></i>
          </div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
          <span v-if="step.route" class="step-link">点击体验 →</span>
        </div>
      </div>

      <div class="guide-actions">
        <button class="btn primary" @click="startUsing">开始使用</button>
        <button class="btn secondary" @click="skipGuide">跳过</button>
      </div>

      <!-- 答辩演示模式 -->
      <div class="demo-section">
        <el-divider>
          <span class="demo-divider-text">答辩演示路径</span>
        </el-divider>
        <div class="demo-steps">
          <div
            v-for="(demo, index) in demoSteps"
            :key="index"
            class="demo-step"
            @click="goToStep(demo.route)"
          >
            <div class="demo-num">{{ index + 1 }}</div>
            <div class="demo-info">
              <div class="demo-title">{{ demo.title }}</div>
              <div class="demo-desc">{{ demo.desc }}</div>
            </div>
            <el-icon class="demo-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()

const steps = [
  {
    icon: 'fas fa-smile',
    title: '记录情绪',
    description: '记录当下的情绪状态，追踪变化趋势',
    route: '/mood/record',
  },
  {
    icon: 'fas fa-chart-pie',
    title: '查看分析',
    description: '了解情绪模式，获取个性化调节建议',
    route: '/mood/insight',
  },
  {
    icon: 'fas fa-leaf',
    title: '放松减压',
    description: '尝试呼吸练习、音乐放松等方式缓解压力',
    route: '/relax',
  },
  {
    icon: 'fas fa-comments',
    title: '倾诉交流',
    description: '在树洞中匿名分享，获得同伴支持',
    route: '/relax/treehole',
  },
]

// 答辩演示6步路径
const demoSteps = [
  {
    title: '登录/注册',
    desc: '使用演示账号登录系统，体验完整功能',
    route: '/login',
  },
  {
    title: '情绪记录',
    desc: '记录当前情绪状态，选择情绪类型和触发因素',
    route: '/mood/record',
  },
  {
    title: '心理测评',
    desc: '完成专业心理量表，获取 AI 解读报告',
    route: '/improve/questionnaire',
  },
  {
    title: 'AI 智能建议',
    desc: '查看基于情绪和测评数据的个性化 AI 建议',
    route: '/mood/insight',
  },
  {
    title: '社区互动',
    desc: '浏览树洞帖子、音乐放松、团体活动',
    route: '/relax',
  },
  {
    title: '管理分析',
    desc: '管理员查看用户数据、活动统计和审计日志',
    route: '/admin/dashboard',
  },
]

const goToStep = (route: string) => {
  router.push(route)
}

const startUsing = () => {
  // 标记引导已完成
  localStorage.setItem('guideCompleted', 'true')
  router.push('/')
}

const skipGuide = () => {
  // 标记引导已完成
  localStorage.setItem('guideCompleted', 'true')
  router.push('/')
}
</script>

<style scoped lang="scss">
.guide-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.guide-container {
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 800px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.guide-container h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 10px;
}

.disclaimer {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 40px;
  line-height: 1.5;
}

.guide-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 30px;
  margin-bottom: 40px;
}

.step {
  padding: 20px;
  border-radius: 15px;
  background: #f8f9fa;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;

  &.clickable {
    cursor: pointer;

    &:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
      background: #eef1ff;
    }
  }

  &:not(.clickable):hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
}

.step-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #667eea;
  font-weight: 500;
}

// 答辩演示模式
.demo-section {
  margin-top: 40px;
  text-align: left;
}

.demo-divider-text {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.demo-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.demo-step {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-radius: 12px;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #eef1ff;
    transform: translateX(4px);

    .demo-arrow {
      opacity: 1;
      transform: translateX(0);
    }
  }
}

.demo-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.demo-info {
  flex: 1;
  min-width: 0;
}

.demo-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.demo-desc {
  font-size: 13px;
  color: #909399;
}

.demo-arrow {
  color: #667eea;
  opacity: 0.5;
  transform: translateX(-4px);
  transition: all 0.2s ease;
}

.step-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  font-size: 1.5rem;
}

.step h3 {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 10px;
}

.step p {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.guide-actions {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 40px;
}

.btn {
  padding: 12px 30px;
  border: none;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
  }

  &.secondary {
    background: #f8f9fa;
    color: #333;
    border: 1px solid #ddd;

    &:hover {
      background: #e9ecef;
      transform: translateY(-2px);
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .guide-container {
    padding: 30px 20px;
  }

  .guide-container h1 {
    font-size: 2rem;
  }

  .guide-steps {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .guide-actions {
    flex-direction: column;
    align-items: center;
  }

  .btn {
    width: 100%;
    max-width: 200px;
  }
}
</style>
