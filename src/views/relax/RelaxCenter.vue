<template>
  <div class="relax-center">
    <header class="page-header">
      <h1>解压中心</h1>
      <p>选择适合你的放松方式，释放压力，找回内心的平静</p>
    </header>

    <div class="mode-filter">
      <button
        v-for="filter in modeFilters"
        :key="filter.key"
        type="button"
        :class="{ active: activeFilter === filter.key }"
        @click="activeFilter = filter.key"
      >
        {{ filter.label }}
      </button>
    </div>

    <AudioPlayer />

    <div v-if="filteredModes.length > 0" class="relax-modes">
      <button
        v-for="mode in filteredModes"
        :key="mode.id"
        type="button"
        class="mode-card"
        :class="{ active: activeMode === mode.id }"
        @click="activeMode = mode.id"
        :aria-label="`选择${mode.name}，${mode.description}`"
      >
        <div class="mode-icon">{{ mode.icon }}</div>
        <div class="mode-info">
          <h3>{{ mode.name }}</h3>
          <p>{{ mode.description }}</p>
          <span class="mode-meta">{{ mode.duration }}</span>
        </div>
      </button>
    </div>
    <transition name="empty-fade" mode="out-in">
      <RelaxEmptyState
        v-if="relaxModes.length === 0"
        key="center-empty"
        type="center"
        action-text="去音乐疗愈"
        action-to="/relax/music"
      />
    </transition>

    <div class="relax-content">
      <transition name="fade" mode="out-in">
        <div :key="activeMode" class="content-wrapper">
          <component :is="currentComponent" />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MoodWoodenFish from '@/components/relax/MoodWoodenFish.vue'
import BreathingGuide from '@/components/relax/BreathingGuide.vue'
import PinballGame from '@/components/relax/PinballGame.vue'
import TetrisGame from '@/components/relax/TetrisGame.vue'
import AudioPlayer from '@/components/relax/AudioPlayer.vue'
import RelaxEmptyState from '@/components/relax/RelaxEmptyState.vue'

const activeMode = ref('wooden-fish')
const activeFilter = ref('all')

const modeFilters = [
  { key: 'all', label: '全部' },
  { key: 'quiet', label: '安静放松' },
  { key: 'active', label: '活动解压' },
]

const relaxModes = [
  {
    id: 'wooden-fish',
    name: '木鱼敲击',
    icon: '🪘',
    description: '敲击木鱼，释放焦虑',
    duration: '随时开始',
    type: 'quiet',
    component: MoodWoodenFish,
  },
  {
    id: 'breathing',
    name: '呼吸冥想',
    icon: '🧘',
    description: '跟随呼吸，放松身心',
    duration: '3-10分钟',
    type: 'quiet',
    component: BreathingGuide,
  },
  {
    id: 'pinball',
    name: '弹珠消砖',
    icon: '🎮',
    description: '打碎砖块，击碎压力',
    duration: '休闲时长',
    type: 'active',
    component: PinballGame,
  },
  {
    id: 'tetris',
    name: '俄罗斯方块',
    icon: '🧩',
    description: '经典游戏，转移注意力',
    duration: '休闲时长',
    type: 'active',
    component: TetrisGame,
  },
]

const filteredModes = computed(() => {
  if (activeFilter.value === 'all') return relaxModes
  return relaxModes.filter((mode) => mode.type === activeFilter.value)
})

const currentComponent = computed(() => {
  const mode = relaxModes.find((m) => m.id === activeMode.value)
  return mode ? mode.component : MoodWoodenFish
})
</script>

<style scoped lang="scss">
.relax-center {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(240, 184, 96, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(138, 171, 124, 0.06) 0%, transparent 50%),
    var(--bg-color);
  padding: 20px;

  .page-header {
    text-align: center;
    margin-bottom: 20px;

    h1 {
      font-size: 32px;
      color: var(--text-color);
      font-family: var(--font-display);
      margin: 0 0 10px 0;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    p {
      font-size: 16px;
      color: var(--text-light-color);
      margin: 0;
    }
  }

  .mode-filter {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    button {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--surface);
      color: var(--text-color);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
      }

      &.active {
        background: var(--primary-color);
        color: #fff;
        border-color: var(--primary-color);
      }
    }
  }

  .relax-modes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    max-width: 900px;
    margin: 0 auto 30px;

    .mode-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 2px solid var(--border-color);
      box-shadow: var(--shadow-sm);

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
        border-color: rgba(232, 131, 74, 0.3);
      }

      &.active {
        border-color: var(--primary-color);
        background: var(--primary-soft);
        box-shadow: var(--shadow-md);
      }

      .mode-icon {
        font-size: 36px;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-muted);
        border-radius: 12px;
      }

      .mode-info {
        flex: 1;

        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #2c3e50;
          font-weight: 600;
        }

        p {
          margin: 0 0 6px 0;
          font-size: 13px;
          color: #95a5a6;
        }

        .mode-meta {
          font-size: 11px;
          color: var(--primary-color);
          background: var(--primary-soft);
          padding: 2px 8px;
          border-radius: 10px;
        }
      }
    }
  }

  .relax-content {
    max-width: 900px;
    margin: 0 auto;

    .content-wrapper {
      background: white;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

@media (max-width: 768px) {
  .relax-center {
    padding: 16px;

    .page-header {
      h1 {
        font-size: 24px;
      }

      p {
        font-size: 14px;
      }
    }

    .relax-modes {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      .mode-card {
        padding: 16px;
        flex-direction: column;
        text-align: center;

        .mode-icon {
          width: 50px;
          height: 50px;
          font-size: 28px;
        }

        .mode-info {
          h3 {
            font-size: 14px;
          }

          p {
            font-size: 12px;
          }
        }
      }
    }
  }
}
</style>
