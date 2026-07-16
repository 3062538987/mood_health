<template>
  <div class="music-therapy">
    <div class="container">
      <h2 class="title">音乐疗愈</h2>

      <!-- 音乐分类 -->
      <div class="category-container">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{ active: activeCategory === category.id }"
          @click="selectCategory(category.id)"
        >
          <i :class="category.icon"></i>
          <span>{{ category.name }}</span>
        </div>
      </div>

      <!-- 音乐列表 -->
      <div class="music-list">
        <div v-if="isLoadingCatalog" class="loading-skeleton" aria-label="加载中">
          <div v-for="index in 4" :key="index" class="skeleton-row"></div>
        </div>
        <transition name="empty-fade" mode="out-in">
          <RelaxEmptyState
            v-if="!isLoadingCatalog && filteredMusic.length === 0"
            key="music-empty"
            type="music"
            action-text="去解压中心试试"
            action-to="/relax/center"
          />
          <div v-else key="music-list">
            <div
              v-for="music in filteredMusic"
              :key="music.id"
              class="music-item"
              :class="{ active: currentMusic && currentMusic.id === music.id }"
              @click="playMusic(music)"
            >
              <div class="music-info">
                <h3 class="music-title">{{ music.title }}</h3>
                <p class="music-artist">{{ music.artist }}</p>
              </div>
              <div class="music-duration">{{ music.duration }}</div>
            </div>
          </div>
        </transition>
      </div>

      <!-- 播放器 -->
      <div v-if="currentMusic" class="player">
        <div class="player-info">
          <h3>{{ currentMusic.title }}</h3>
          <p>{{ currentMusic.artist }}</p>
        </div>
        <div class="player-controls">
          <button class="control-btn" @click="playPrevious">
            <i class="fas fa-step-backward"></i>
          </button>
          <button class="control-btn play-btn" @click="togglePlay">
            <i v-if="isPlaying" class="fas fa-pause"></i>
            <i v-else class="fas fa-play"></i>
          </button>
          <button class="control-btn" @click="playNext">
            <i class="fas fa-step-forward"></i>
          </button>
        </div>
        <div class="player-progress">
          <input
            v-model.number="currentTime"
            type="range"
            :min="0"
            :max="duration"
            class="progress-bar"
            @input="seek"
          />
          <div class="time-display">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
        </div>
        <div class="player-volume">
          <i class="fas fa-volume-down"></i>
          <input
            v-model.number="volume"
            type="range"
            :min="0"
            :max="1"
            step="0.1"
            class="volume-bar"
            @input="updateVolume"
          />
          <i class="fas fa-volume-up"></i>
        </div>
      </div>

      <!-- 音频元素 -->
      <audio
        ref="audioRef"
        @ended="handleEnded"
        @timeupdate="updateTime"
        @loadedmetadata="updateDuration"
      >
        <source :src="currentMusic?.url" type="audio/mpeg" />
      </audio>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import RelaxEmptyState from '@/components/relax/RelaxEmptyState.vue'

// 音乐分类
interface Category {
  id: string
  name: string
  icon: string
}

// 音乐数据类型
interface Music {
  id: number
  title: string
  artist: string
  url: string
  duration: string
  category: string
}

const categories = ref<Category[]>([
  { id: 'light', name: '轻音乐', icon: 'fas fa-music' },
  { id: 'white', name: '白噪音', icon: 'fas fa-volume-up' },
  { id: 'nature', name: '自然之声', icon: 'fas fa-leaf' },
  { id: 'meditation', name: '冥想音乐', icon: 'fas fa-om' },
])

// 模拟音乐数据
const musicData = ref<Music[]>([
  {
    id: 1,
    title: '宁静致远',
    artist: '轻音乐',
    url: '',
    duration: '3:45',
    category: 'light',
  },
  {
    id: 2,
    title: '雨声',
    artist: '白噪音',
    url: '',
    duration: '5:20',
    category: 'white',
  },
  {
    id: 3,
    title: '森林漫步',
    artist: '自然之声',
    url: '',
    duration: '4:15',
    category: 'nature',
  },
  {
    id: 4,
    title: '冥想指引',
    artist: '冥想音乐',
    url: '',
    duration: '10:00',
    category: 'meditation',
  },
  {
    id: 5,
    title: '钢琴曲',
    artist: '轻音乐',
    url: '',
    duration: '4:30',
    category: 'light',
  },
  {
    id: 6,
    title: '海浪声',
    artist: '自然之声',
    url: '',
    duration: '6:10',
    category: 'nature',
  },
])

// 响应式数据
const activeCategory = ref('light')
const currentMusic = ref<Music | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.7)
const audioRef = ref<HTMLAudioElement | null>(null)
const isLoadingCatalog = ref(true)

// 计算属性：过滤当前分类的音乐
const filteredMusic = computed(() => {
  return musicData.value.filter((music) => music.category === activeCategory.value)
})

// 方法
const selectCategory = (categoryId: string) => {
  activeCategory.value = categoryId
}

const playMusic = (music: Music) => {
  currentMusic.value = music
  if (audioRef.value) {
    audioRef.value.play().catch((error) => {
      console.error('播放失败:', error)
    })
    isPlaying.value = true
  }
}

const togglePlay = () => {
  if (audioRef.value) {
    if (isPlaying.value) {
      audioRef.value.pause()
    } else {
      audioRef.value.play().catch((error) => {
        console.error('播放失败:', error)
      })
    }
    isPlaying.value = !isPlaying.value
  }
}

const playPrevious = () => {
  const currentIndex = filteredMusic.value.findIndex((m) => m.id === currentMusic.value?.id)
  if (currentIndex > 0) {
    playMusic(filteredMusic.value[currentIndex - 1])
  }
}

const playNext = () => {
  const currentIndex = filteredMusic.value.findIndex((m) => m.id === currentMusic.value?.id)
  if (currentIndex < filteredMusic.value.length - 1) {
    playMusic(filteredMusic.value[currentIndex + 1])
  }
}

const handleEnded = () => {
  isPlaying.value = false
  playNext()
}

const updateTime = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const updateDuration = () => {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
  }
}

const seek = () => {
  if (audioRef.value) {
    audioRef.value.currentTime = currentTime.value
  }
}

const updateVolume = () => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 生命周期
onMounted(() => {
  // 初始化时设置音量
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }
  // 给列表一个轻量加载过渡，避免空状态闪烁。
  setTimeout(() => {
    isLoadingCatalog.value = false
  }, 220)
})

onUnmounted(() => {
  // 组件卸载时停止播放
  if (audioRef.value) {
    audioRef.value.pause()
  }
})
</script>

<style scoped lang="scss">
.music-therapy {
  padding: 2rem;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .title {
    text-align: center;
    font-size: 2.5rem;
    color: #333;
    margin-bottom: 2rem;
    font-weight: 700;
  }

  .category-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;

    .category-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      background: white;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

      i {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        color: #4a90e2;
      }

      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
      }

      &.active {
        background: #4a90e2;
        color: white;

        i {
          color: white;
        }
      }
    }
  }

  .music-list {
    background: white;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 2rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    .loading-skeleton {
      display: grid;
      gap: 10px;

      .skeleton-row {
        height: 72px;
        border-radius: 12px;
        background: linear-gradient(90deg, #edf2ff 25%, #f8f9ff 37%, #edf2ff 63%);
        background-size: 400% 100%;
        animation: shimmer 1.2s ease-in-out infinite;
      }
    }

    .music-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all 0.3s ease;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: #f5f7fa;
      }

      &.active {
        background: #e6f0fa;
        border-left: 4px solid #4a90e2;
      }

      .music-info {
        flex: 1;

        .music-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
          color: #333;
        }

        .music-artist {
          font-size: 0.9rem;
          color: #666;
          margin: 0;
        }
      }

      .music-duration {
        color: #999;
        font-size: 0.9rem;
      }
    }
  }

  .player {
    background: white;
    border-radius: 10px;
    padding: 1.5rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    .player-info {
      text-align: center;
      margin-bottom: 1rem;

      h3 {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0 0 0.25rem 0;
        color: #333;
      }

      p {
        font-size: 1rem;
        color: #666;
        margin: 0;
      }
    }

    .player-controls {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 1rem;

      .control-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #4a90e2;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.1);
          color: #357abd;
        }

        &.play-btn {
          font-size: 2rem;
          background: #4a90e2;
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            background: #357abd;
            transform: scale(1.1);
          }
        }
      }
    }

    .player-progress {
      margin-bottom: 1rem;

      .progress-bar {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #f0f0f0;
        outline: none;
        -webkit-appearance: none;

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4a90e2;
          cursor: pointer;
        }
      }

      .time-display {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: #999;
        margin-top: 0.5rem;
      }
    }

    .player-volume {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      i {
        color: #666;
      }

      .volume-bar {
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: #f0f0f0;
        outline: none;
        -webkit-appearance: none;

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #4a90e2;
          cursor: pointer;
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .music-therapy {
    padding: 1rem;

    .title {
      font-size: 2rem;
    }

    .category-container {
      gap: 0.5rem;

      .category-item {
        padding: 0.75rem;

        i {
          font-size: 1.5rem;
        }

        span {
          font-size: 0.9rem;
        }
      }
    }

    .player {
      padding: 1rem;

      .player-controls {
        gap: 1rem;

        .control-btn {
          font-size: 1.25rem;

          &.play-btn {
            font-size: 1.5rem;
            width: 40px;
            height: 40px;
          }
        }
      }
    }
  }
}

.empty-fade-enter-active,
.empty-fade-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.empty-fade-enter-from,
.empty-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
