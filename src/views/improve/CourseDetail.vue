<template>
  <div class="course-detail-container">
    <button class="back-button" @click="goBack">
      <span>←</span> 返回课程列表
    </button>
    
    <!-- 课程信息 -->
    <div v-if="course" class="course-detail">
      <div class="course-header">
        <div class="course-cover-large">
          <img :src="course.coverUrl" :alt="course.title" />
        </div>
        <div class="course-info-large">
          <h1 class="course-title-large">{{ course.title }}</h1>
          <div class="course-meta-large">
            <span class="course-category-large">{{ course.category }}</span>
            <span class="course-study-count-large">{{ course.studyCount }}人学习</span>
          </div>
          <p class="course-description-large">{{ course.description }}</p>
        </div>
      </div>
      
      <!-- 课程内容 -->
      <div class="course-content">
        <h2 class="content-title">课程内容</h2>
        
        <!-- 视频内容 -->
        <div v-if="course.type === 'video'" class="video-container">
          <video 
            controls 
            class="course-video"
            :src="course.content"
            :poster="course.coverUrl"
          >
            您的浏览器不支持视频播放
          </video>
        </div>
        
        <!-- 文章内容 -->
        <div v-else class="article-container">
          <div class="article-content" v-html="course.content"></div>
        </div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="!loading && !course" class="error-state">
      <p>课程不存在或加载失败</p>
      <button class="back-button" @click="goBack">返回课程列表</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const course = ref<any>(null);
const loading = ref(true);

const fetchCourseDetail = async () => {
  loading.value = true;
  try {
    const courseId = route.params.id;
    const response = await fetch(`http://localhost:3000/api/courses/${courseId}`);
    const data = await response.json();
    course.value = data;
  } catch (error) {
    console.error('Error fetching course detail:', error);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/improve/courses');
};

onMounted(() => {
  fetchCourseDetail();
});
</script>

<style scoped>
.course-detail-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 20px;
  font-size: 14px;
}

.back-button:hover {
  border-color: #4CAF50;
  color: #4CAF50;
}

.course-header {
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.course-cover-large {
  height: 400px;
  overflow: hidden;
}

.course-cover-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.course-info-large {
  padding: 20px;
}

.course-title-large {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
}

.course-meta-large {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  font-size: 14px;
  color: #666;
}

.course-category-large {
  background: #f5f5f5;
  padding: 4px 12px;
  border-radius: 15px;
}

.course-description-large {
  font-size: 16px;
  color: #666;
  line-height: 1.5;
}

.course-content {
  background: white;
  border-radius: 10px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.content-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
}

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 比例 */
  height: 0;
  overflow: hidden;
  margin-bottom: 20px;
}

.course-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.article-container {
  line-height: 1.8;
  color: #333;
}

.article-content {
  font-size: 16px;
}

.article-content p {
  margin-bottom: 15px;
}

.article-content h3 {
  margin-top: 25px;
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: bold;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 100px;
  color: #999;
}

.error-state button {
  margin-top: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .course-cover-large {
    height: 250px;
  }
  
  .course-info-large {
    padding: 15px;
  }
  
  .course-title-large {
    font-size: 20px;
  }
  
  .course-content {
    padding: 20px;
  }
  
  .content-title {
    font-size: 18px;
  }
  
  .article-content {
    font-size: 15px;
  }
}
</style>