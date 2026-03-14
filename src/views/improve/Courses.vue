<template>
  <div class="courses-container">
    <h1 class="page-title">成长课程</h1>
    
    <!-- 分类标签 -->
    <div class="category-tabs">
      <button 
        v-for="category in categories" 
        :key="category"
        :class="['category-tab', { active: activeCategory === category }]"
        @click="setActiveCategory(category)"
      >
        {{ category }}
      </button>
    </div>
    
    <!-- 课程列表 -->
    <div class="courses-list">
      <div 
        v-for="course in courses" 
        :key="course.id"
        class="course-card"
        @click="navigateToCourseDetail(course.id)"
      >
        <div class="course-cover">
          <img :src="course.coverUrl" :alt="course.title" />
        </div>
        <div class="course-info">
          <h3 class="course-title">{{ course.title }}</h3>
          <p class="course-description">{{ course.description }}</p>
          <div class="course-meta">
            <span class="course-category">{{ course.category }}</span>
            <span class="course-study-count">{{ course.studyCount }}人学习</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && courses.length === 0" class="empty-state">
      <p>暂无课程</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const categories = ['全部', '心理知识', '情绪调节', '人际交往'];
const activeCategory = ref('全部');
const courses = ref<any[]>([]);
const loading = ref(true);

const setActiveCategory = (category: string) => {
  activeCategory.value = category;
  fetchCourses();
};

const fetchCourses = async () => {
  loading.value = true;
  try {
    const category = activeCategory.value === '全部' ? '' : activeCategory.value;
    const response = await fetch(`http://localhost:3000/api/courses?category=${category}`);
    const data = await response.json();
    courses.value = data;
  } catch (error) {
    console.error('Error fetching courses:', error);
  } finally {
    loading.value = false;
  }
};

const navigateToCourseDetail = (courseId: number) => {
  router.push(`/improve/course/${courseId}`);
};

onMounted(() => {
  fetchCourses();
});
</script>

<style scoped>
.courses-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 30px;
  text-align: center;
  color: #333;
}

.category-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  gap: 10px;
}

.category-tab {
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.category-tab:hover {
  border-color: #4CAF50;
  color: #4CAF50;
}

.category-tab.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.courses-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.course-card {
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.course-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
}

.course-cover {
  height: 180px;
  overflow: hidden;
}

.course-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.course-card:hover .course-cover img {
  transform: scale(1.05);
}

.course-info {
  padding: 15px;
}

.course-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
  line-height: 1.4;
}

.course-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.course-category {
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 10px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 50px;
  color: #999;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .courses-list {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
  
  .category-tabs {
    flex-wrap: wrap;
  }
  
  .category-tab {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>