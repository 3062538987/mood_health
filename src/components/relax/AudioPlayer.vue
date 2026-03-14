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
        <button @click="togglePlay" class="play-btn">
          {{ isPlaying ? "⏸" : "▶" }}
        </button>

        <div class="volume-control">
          <span class="volume-icon">🔊</span>
          <input
            type="range"
            min="0"
            max="100"
            v-model.number="volume"
            @input="adjustVolume"
            class="volume-slider"
          />
        </div>

        <div class="loop-control">
          <input
            type="checkbox"
            id="loop"
            v-model="isLoop"
            @change="toggleLoop"
          />
          <label for="loop">循环播放</label>
        </div>
      </div>
    </div>

    <audio
      ref="audioElement"
      @ended="handleEnded"
      class="audio-element"
    ></audio>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import useRelaxStore from "@/stores/relaxStore";
import useAchievementStore from "@/stores/achievementStore";

const audioElement = ref<HTMLAudioElement | null>(null);
const selectedAudio = ref("rain");
const isPlaying = ref(false);
const volume = ref(50);
const isLoop = ref(true);
const startTime = ref(new Date().toISOString());

const relaxStore = useRelaxStore();
const achievementStore = useAchievementStore();

const audioFiles = {
  rain: "/audio/rain.mp3",
  ocean: "/audio/ocean.mp3",
  fire: "/audio/fire.mp3",
};

const changeAudio = () => {
  if (audioElement.value) {
    audioElement.value.src =
      audioFiles[selectedAudio.value as keyof typeof audioFiles];
    if (isPlaying.value) {
      audioElement.value.play().catch((err) => console.error("播放失败:", err));
    }
  }
};

const togglePlay = async () => {
  if (audioElement.value) {
    if (isPlaying.value) {
      audioElement.value.pause();
      await saveRelaxRecord();
    } else {
      startTime.value = new Date().toISOString(); // 重置开始时间
      audioElement.value.play().catch((err) => console.error("播放失败:", err));
    }
    isPlaying.value = !isPlaying.value;
  }
};

const adjustVolume = () => {
  if (audioElement.value) {
    audioElement.value.volume = volume.value / 100;
  }
};

const toggleLoop = () => {
  if (audioElement.value) {
    audioElement.value.loop = isLoop.value;
  }
};

const handleEnded = async () => {
  if (!isLoop.value) {
    isPlaying.value = false;
    await saveRelaxRecord();
  }
};

const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString();
  await relaxStore.saveRecord({
    activityType: "audio",
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      audioType: selectedAudio.value,
      volume: volume.value,
      isLoop: isLoop.value,
    },
  });
  // 检查成就
  await achievementStore.checkAchievements();
};

onMounted(() => {
  if (audioElement.value) {
    audioElement.value.src =
      audioFiles[selectedAudio.value as keyof typeof audioFiles];
    audioElement.value.volume = volume.value / 100;
    audioElement.value.loop = isLoop.value;
  }
});

onUnmounted(async () => {
  if (audioElement.value && isPlaying.value) {
    audioElement.value.pause();
    await saveRelaxRecord();
  }
});
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
      gap: 20px;

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

      .loop-control {
        display: flex;
        align-items: center;
        gap: 6px;

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #42b983;
        }

        label {
          font-size: 14px;
          color: #2c3e50;
          cursor: pointer;
        }
      }
    }
  }

  .audio-element {
    display: none;
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
