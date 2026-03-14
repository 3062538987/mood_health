<template>
  <div class="relax-center">
    <header class="page-header">
      <h1>解压中心</h1>
      <p>选择适合你的放松方式，释放压力，找回内心的平静</p>
    </header>

    <AudioPlayer />

    <div class="relax-modes">
      <div
        v-for="mode in relaxModes"
        :key="mode.id"
        class="mode-card"
        :class="{ active: activeMode === mode.id }"
        @click="activeMode = mode.id"
      >
        <div class="mode-icon">{{ mode.icon }}</div>
        <div class="mode-info">
          <h3>{{ mode.name }}</h3>
          <p>{{ mode.description }}</p>
        </div>
      </div>
    </div>

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
import { ref, computed } from "vue";
import MoodWoodenFish from "@/components/relax/MoodWoodenFish.vue";
import BreathingGuide from "@/components/relax/BreathingGuide.vue";
import PinballGame from "@/components/relax/PinballGame.vue";
import TetrisGame from "@/components/relax/TetrisGame.vue";
import AudioPlayer from "@/components/relax/AudioPlayer.vue";

const activeMode = ref("wooden-fish");

const relaxModes = [
  {
    id: "wooden-fish",
    name: "木鱼敲击",
    icon: "🪘",
    description: "敲击木鱼，释放焦虑",
    component: MoodWoodenFish,
  },
  {
    id: "breathing",
    name: "呼吸冥想",
    icon: "🧘",
    description: "跟随呼吸，放松身心",
    component: BreathingGuide,
  },
  {
    id: "pinball",
    name: "弹珠消砖",
    icon: "🎮",
    description: "打碎砖块，击碎压力",
    component: PinballGame,
  },
  {
    id: "tetris",
    name: "俄罗斯方块",
    icon: "🧩",
    description: "经典游戏，转移注意力",
    component: TetrisGame,
  },
];

const currentComponent = computed(() => {
  const mode = relaxModes.find((m) => m.id === activeMode.value);
  return mode ? mode.component : MoodWoodenFish;
});
</script>

<style scoped lang="scss">
.relax-center {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  padding: 20px;

  .page-header {
    text-align: center;
    margin-bottom: 30px;

    h1 {
      font-size: 32px;
      color: #2c3e50;
      margin: 0 0 10px 0;
      font-weight: 600;
    }

    p {
      font-size: 16px;
      color: #7f8c8d;
      margin: 0;
    }
  }

  .relax-modes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    max-width: 900px;
    margin: 0 auto 30px;

    .mode-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 2px solid transparent;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      }

      &.active {
        border-color: #42b983;
        background: linear-gradient(135deg, #fff 0%, #f0faf6 100%);
        box-shadow: 0 8px 25px rgba(66, 185, 131, 0.2);
      }

      .mode-icon {
        font-size: 36px;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
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
          margin: 0;
          font-size: 13px;
          color: #95a5a6;
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
