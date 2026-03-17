<template>
  <div class="knowledge-view">
    <div class="container">
      <h1 class="page-title">情绪知识科普专区</h1>

      <!-- 知识分类导航 -->
      <div class="category-nav">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{ active: selectedCategory === category.id }"
          @click="selectedCategory = category.id"
        >
          <div class="category-icon">{{ category.icon }}</div>
          <div class="category-info">
            <h3>{{ category.name }}</h3>
            <p>{{ category.description }}</p>
          </div>
        </div>
      </div>

      <!-- 内容类型筛选 -->
      <div class="content-type-filter">
        <button
          v-for="type in contentTypes"
          :key="type"
          class="filter-btn"
          :class="{ active: selectedType === type }"
          @click="selectedType = type"
        >
          {{ typeLabels[type] }}
        </button>
      </div>

      <!-- 知识内容列表 -->
      <div class="knowledge-grid">
        <div v-for="item in filteredKnowledge" :key="item.id" class="knowledge-card">
          <!-- 视频内容 -->
          <div v-if="item.type === 'video'" class="card-media">
            <div class="video-placeholder">
              <div class="play-button">▶</div>
              <div class="video-duration">{{ item.duration }}</div>
            </div>
          </div>

          <!-- 文字内容 -->
          <div class="card-content">
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-description">{{ item.description }}</p>
            <div class="card-meta">
              <span class="content-type-badge">{{ item.type === 'video' ? '视频' : '文字' }}</span>
              <button
                class="favorite-btn"
                :class="{ favorited: isFavorited(item.id) }"
                @click="toggleFavorite(item.id)"
              >
                {{ isFavorited(item.id) ? '❤' : '🤍' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredKnowledge.length === 0" class="empty-state">
        <p>暂无相关知识内容</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 知识分类定义
interface KnowledgeCategory {
  id: string
  name: string
  description: string
  icon: string
}

// 知识内容定义
interface KnowledgeItem {
  id: string
  categoryId: string
  title: string
  description: string
  type: 'text' | 'video'
  duration?: string // 视频时长
  content: string // 具体内容或视频链接
}

// 状态管理
const selectedCategory = ref('perception') // 默认选中情绪知觉
const selectedType = ref<'all' | 'text' | 'video'>('all') // 默认显示所有类型
const favorites = ref<string[]>([]) // 收藏的知识id列表

// 分类数据
const categories: KnowledgeCategory[] = [
  {
    id: 'perception',
    name: '情绪知觉',
    description: '认识你的情绪密码',
    icon: '🔍',
  },
  {
    id: 'experience',
    name: '情绪体验',
    description: '感受情绪的变化',
    icon: '💭',
  },
  {
    id: 'control',
    name: '情绪控制',
    description: '掌握情绪的开关',
    icon: '⚡',
  },
  {
    id: 'regulation',
    name: '情绪调节',
    description: '提升情绪管理能力',
    icon: '🌱',
  },
]

// 内容类型
const contentTypes: ('all' | 'text' | 'video')[] = ['all', 'text', 'video']
const typeLabels = {
  all: '全部',
  text: '文字',
  video: '视频',
}

// 模拟知识数据
const knowledgeItems: KnowledgeItem[] = [
  // 情绪知觉 - 基础理论
  {
    id: 'perception-001',
    categoryId: 'perception',
    title: '情绪是什么？——心理学中的情绪三要素',
    description: '了解情绪的认知、生理和行为三个要素',
    type: 'text',
    content: '情绪是由认知评估、生理变化和行为反应三个要素组成的...',
  },
  {
    id: 'perception-002',
    categoryId: 'perception',
    title: '情绪ABC理论：改变想法，改变情绪',
    description: '用动画演示情绪ABC理论的应用过程',
    type: 'video',
    duration: '2:15',
    content: 'video-url-001',
  },

  // 情绪体验 - 实用技巧
  {
    id: 'experience-001',
    categoryId: 'experience',
    title: '正念呼吸三步法：缓解即时焦虑',
    description: '简单有效的呼吸技巧，快速平静情绪',
    type: 'text',
    content: '第一步：深吸一口气，数4秒...',
  },

  // 情绪控制 - 案例解析
  {
    id: 'control-001',
    categoryId: 'control',
    title: '案例：小明因朋友圈感到自卑，如何应对？',
    description: '分析社交媒体对情绪的影响及应对方法',
    type: 'text',
    content: '小明看到朋友圈里别人的成功感到自卑...',
  },

  // 情绪调节 - 视频内容
  {
    id: 'regulation-001',
    categoryId: 'regulation',
    title: '用动画演示情绪调节的5个步骤',
    description: '通过动画直观学习情绪调节技巧',
    type: 'video',
    duration: '1:45',
    content: 'video-url-002',
  },
]

// 筛选知识内容
const filteredKnowledge = computed(() => {
  return knowledgeItems.filter((item) => {
    const categoryMatch = selectedCategory.value === item.categoryId
    const typeMatch = selectedType.value === 'all' || selectedType.value === item.type
    return categoryMatch && typeMatch
  })
})

// 收藏功能
const isFavorited = (id: string) => {
  return favorites.value.includes(id)
}

const toggleFavorite = (id: string) => {
  const index = favorites.value.indexOf(id)
  if (index > -1) {
    favorites.value.splice(index, 1)
  } else {
    favorites.value.push(id)
  }
}
</script>

<style scoped lang="scss">
.knowledge-view {
  min-height: 100vh;
  background: #f5f7fa;

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .page-title {
    text-align: center;
    color: #42b983;
    margin: 0 0 40px 0;
    font-size: 32px;
  }
}

// 分类导航样式
.category-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;

  .category-item {
    background: white;
    border-radius: 12px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 2px solid transparent;

    &:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    &.active {
      border-color: #42b983;
      box-shadow: 0 4px 15px rgba(66, 185, 131, 0.15);
    }

    .category-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .category-info {
      h3 {
        margin: 0 0 8px 0;
        color: #333;
        font-size: 20px;
      }

      p {
        margin: 0;
        color: #666;
        font-size: 14px;
      }
    }
  }
}

// 内容类型筛选样式
.content-type-filter {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
  justify-content: center;

  .filter-btn {
    background: white;
    border: 1px solid #ddd;
    border-radius: 20px;
    padding: 8px 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;

    &:hover {
      border-color: #42b983;
      color: #42b983;
    }

    &.active {
      background: #42b983;
      color: white;
      border-color: #42b983;
    }
  }
}

// 知识卡片网格
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;

  .knowledge-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .card-media {
      height: 200px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;

      .video-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        position: relative;

        .play-button {
          font-size: 60px;
          opacity: 0.8;
        }

        .video-duration {
          position: absolute;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.6);
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
      }
    }

    .card-content {
      padding: 20px;

      .card-title {
        margin: 0 0 12px 0;
        color: #333;
        font-size: 18px;
        line-height: 1.4;
      }

      .card-description {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 14px;
        line-height: 1.6;
      }

      .card-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .content-type-badge {
          background: #e8f5e9;
          color: #42b983;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .favorite-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          transition: all 0.3s ease;

          &:hover {
            transform: scale(1.2);
          }

          &.favorited {
            color: #ff4757;
          }
        }
      }
    }
  }
}

// 空状态样式
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #999;
  font-size: 18px;
}

// 响应式设计
@media (max-width: 768px) {
  .category-nav {
    grid-template-columns: 1fr;
  }

  .knowledge-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 24px;
  }
}
</style>
