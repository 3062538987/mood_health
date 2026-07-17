<template>
  <div class="audio-player">
    <div class="player-controls">
      <div class="audio-selector">
        <label for="audio-select">选择音频：</label>
        <select id="audio-select" v-model="selectedAudio" @change="changeAudio">
          <option value="rain">雨声</option>
          <option value="ocean">海浪</option>
          <option value="fire">篝火</option>
        </select>
      </div>

      <div class="playback-controls">
        <button class="play-btn" @click="togglePlay">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>

        <!-- 音频可视化 -->
        <div class="visualizer" :class="{ active: isPlaying }">
          <span v-for="i in 5" :key="i" class="bar" :style="{ animationDelay: i * 0.12 + 's' }"></span>
        </div>

        <div class="volume-control">
          <span class="volume-icon">🔊</span>
          <input
            v-model.number="volume"
            type="range"
            min="0"
            max="100"
            class="volume-slider"
            @input="adjustVolume"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import useRelaxStore from '@/stores/relaxStore'
import useAchievementStore from '@/stores/achievementStore'
import { audioGenerator } from '@/utils/audioGenerator'

const selectedAudio = ref('rain')
const isPlaying = ref(false)
const volume = ref(50)
const startTime = ref(new Date().toISOString())

const relaxStore = useRelaxStore()
const achievementStore = useAchievementStore()

const changeAudio = () => {
  if (isPlaying.value) {
    playAudio()
  }
}

const playAudio = () => {
  switch (selectedAudio.value) {
    case 'rain': audioGenerator.playRain(); break
    case 'ocean': audioGenerator.playOcean(); break
    case 'fire': audioGenerator.playFire(); break
  }
  audioGenerator.setVolume(volume.value / 100)
}

const togglePlay = async () => {
  if (isPlaying.value) {
    audioGenerator.stop()
    await saveRelaxRecord()
  } else {
    startTime.value = new Date().toISOString()
    playAudio()
  }
  isPlaying.value = !isPlaying.value
}

const adjustVolume = () => {
  audioGenerator.setVolume(volume.value / 100)
}

const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString()
  await relaxStore.saveRecord({
    activityType: 'audio',
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      audioType: selectedAudio.value,
      volume: volume.value,
    },
  })
  await achievementStore.checkAchievements()
}

onUnmounted(() => {
  audioGenerator.stop()
})
</script>

<style scoped lang="scss">
.audio-player {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);

  .player-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .audio-selector {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 14px;
        color: #2c3e50;
        font-weight: 500;
      }

      select {
        padding: 8px 12px;
        border: 2px solid #e4e8ec;
        border-radius: 8px;
        background: white;
        font-size: 14px;
        color: #2c3e50;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          border-color: #42b983;
        }

        &:focus {
          outline: none;
          border-color: #42b983;
          box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
        }
      }
    }

    .playback-controls {
        display: flex;
        align-items: center;
        gap: 16px;

        @media (max-width: 768px) {
          justify-content: space-between;
        }

        .play-btn {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 50%;
          background: linear-gradient(135deg, #42b983 0%, #35495e 100%);
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;

          &:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 15px rgba(66, 185, 131, 0.4);
          }

          &:active {
            transform: scale(0.95);
          }
        }

        .visualizer {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 28px;
          padding: 0 4px;

          .bar {
            width: 4px;
            height: 6px;
            background: #d0d0d0;
            border-radius: 2px;
            transition: background 0.3s;
          }

          &.active .bar {
            background: #42b983;
            animation: visualize 0.8s ease-in-out infinite alternate;
          }
        }

        @keyframes visualize {
          0% { height: 6px; }
          100% { height: 24px; }
        }

        .volume-control {
          display: flex;
          align-items: center;
          gap: 8px;

          .volume-icon {
            font-size: 16px;
          }

          .volume-slider {
            width: 100px;
            height: 4px;
            -webkit-appearance: none;
            appearance: none;
            background: #e4e8ec;
            border-radius: 2px;
            outline: none;
            cursor: pointer;

            &::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #42b983;
              cursor: pointer;
              transition: all 0.3s ease;

              &:hover {
                transform: scale(1.2);
                box-shadow: 0 0 10px rgba(66, 185, 131, 0.5);
              }
            }

            &::-moz-range-thumb {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #42b983;
              cursor: pointer;
              border: none;
              transition: all 0.3s ease;

              &:hover {
                transform: scale(1.2);
                box-shadow: 0 0 10px rgba(66, 185, 131, 0.5);
              }
            }
          }
        }
      }
  }
}

@media (max-width: 768px) {
  .audio-player {
    padding: 12px;

    .player-controls {
      .audio-selector {
        select {
          flex: 1;
        }
      }

      .playback-controls {
        .volume-control {
          .volume-slider {
            width: 80px;
          }
        }
      }
    }
  }
}
</style>
