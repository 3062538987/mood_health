<template>
  <div class="guide-page">
    <div class="guide-container">
      <h1>欢迎使用情绪健康平台</h1>
      <p class="subtitle">开始您的情绪管理之旅</p>
      
      <div class="guide-steps">
        <div class="step" v-for="(step, index) in steps" :key="index">
          <div class="step-icon">
            <i :class="step.icon"></i>
          </div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
        </div>
      </div>
      
      <div class="guide-actions">
        <button class="btn primary" @click="startUsing">开始使用</button>
        <button class="btn secondary" @click="skipGuide">跳过</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

const steps = [
  {
    icon: "fas fa-smile",
    title: "情绪记录",
    description: "记录您的情绪状态，了解情绪变化趋势"
  },
  {
    icon: "fas fa-chart-pie",
    title: "情绪分析",
    description: "通过图表分析您的情绪模式和触发因素"
  },
  {
    icon: "fas fa-leaf",
    title: "放松减压",
    description: "使用音乐和树洞功能缓解压力，放松心情"
  },
  {
    icon: "fas fa-chart-line",
    title: "自我提升",
    description: "参与团体辅导和成长课程，提升情绪管理能力"
  }
];

const startUsing = () => {
  // 标记引导已完成
  localStorage.setItem('guideCompleted', 'true');
  router.push('/');
};

const skipGuide = () => {
  // 标记引导已完成
  localStorage.setItem('guideCompleted', 'true');
  router.push('/');
};
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
  margin-bottom: 40px;
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
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
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