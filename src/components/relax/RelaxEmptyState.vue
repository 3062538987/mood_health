<template>
  <section class="relax-empty-state" :class="`type-${type}`">
    <div class="illustration" aria-hidden="true">
      <div v-if="type === 'history'" class="scene history-scene">
        <div class="cloud"></div>
        <div class="cat">😺</div>
        <div class="headphone">🎧</div>
      </div>
      <div v-else-if="type === 'achievements'" class="scene badge-scene">
        <div class="trophy">🏆</div>
        <div class="badge badge-a">⭐</div>
        <div class="badge badge-b">✨</div>
      </div>
      <div v-else-if="type === 'treehole'" class="scene tree-scene">
        <div class="bubble">💬</div>
        <div class="sapling">🌱</div>
      </div>
      <div v-else-if="type === 'music'" class="scene music-scene">
        <div class="music-note note-a">♪</div>
        <div class="music-note note-b">♫</div>
        <div class="headphone">🎧</div>
      </div>
      <div v-else class="scene center-scene">
        <div class="bubble-a">○</div>
        <div class="bubble-b">◎</div>
        <div class="face">😌</div>
      </div>
    </div>

    <h3>{{ title }}</h3>
    <p>{{ description }}</p>

    <button v-if="actionText" type="button" class="action-btn" @click="handleAction">
      {{ actionText }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

type RelaxEmptyType = 'center' | 'history' | 'achievements' | 'treehole' | 'music'

const props = withDefaults(
  defineProps<{
    type: RelaxEmptyType
    title?: string
    description?: string
    actionText?: string
    actionTo?: string
  }>(),
  {
    actionText: '',
    actionTo: '',
  }
)

const emit = defineEmits<{
  action: []
}>()

const router = useRouter()

const defaultCopy = {
  center: {
    title: '暂时没有可展示的放松方式',
    description: '先喝口水，深呼吸一下，我们会把新的解压内容准备好。',
  },
  history: {
    title: '还没有放松记录哦',
    description: '去试试解压方法吧，第一次记录会让你的情绪旅程更完整。',
  },
  achievements: {
    title: '成就徽章正在等你点亮',
    description: '先完成一次放松练习，属于你的第一枚徽章就会出现。',
  },
  treehole: {
    title: '树洞里暂时很安静',
    description: '把此刻的心情写下来，也许会遇见温柔回应。',
  },
  music: {
    title: '还没有匹配到音乐疗愈内容',
    description: '先去解压中心体验一轮呼吸放松，再回来挑一首适合你的旋律。',
  },
}

const title = computed(() => props.title || defaultCopy[props.type].title)
const description = computed(() => props.description || defaultCopy[props.type].description)

const handleAction = () => {
  emit('action')
  if (props.actionTo) {
    router.push(props.actionTo)
  }
}
</script>

<style scoped lang="scss">
.relax-empty-state {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  padding: 2rem 1.25rem;
  border-radius: 16px;
  background: linear-gradient(180deg, #fdfcff, #f7faff);
  border: 1px solid #dfe7ff;
  text-align: center;
}

.illustration {
  width: 170px;
  height: 120px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eef4ff, #f8f1ff);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.scene {
  position: relative;
  width: 100%;
  height: 100%;
}

h3 {
  margin: 0;
  color: #3f4c72;
  font-size: 1.08rem;
}

p {
  margin: 0;
  max-width: 32rem;
  color: #6b779b;
  line-height: 1.65;
}

.action-btn {
  border: none;
  border-radius: 999px;
  padding: 0.58rem 1rem;
  color: #fff;
  background: linear-gradient(135deg, #7db3ff, #9f90ff);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.action-btn:hover {
  transform: scale(1.04);
  filter: brightness(1.02);
  box-shadow: 0 10px 20px rgba(125, 179, 255, 0.28);
}

.history-scene .cloud {
  position: absolute;
  top: 18px;
  left: 30px;
  width: 74px;
  height: 26px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 16px -10px 0 #ffffff;
}

.history-scene .cat {
  position: absolute;
  left: 22px;
  bottom: 14px;
  font-size: 1.6rem;
}

.history-scene .headphone,
.music-scene .headphone {
  position: absolute;
  right: 22px;
  bottom: 18px;
  font-size: 1.6rem;
}

.badge-scene .trophy {
  position: absolute;
  left: 70px;
  top: 36px;
  font-size: 1.8rem;
}

.badge-scene .badge {
  position: absolute;
  font-size: 1.15rem;
}

.badge-scene .badge-a {
  left: 40px;
  top: 26px;
}

.badge-scene .badge-b {
  right: 38px;
  top: 52px;
}

.tree-scene .bubble {
  position: absolute;
  left: 36px;
  top: 26px;
  font-size: 1.7rem;
}

.tree-scene .sapling {
  position: absolute;
  right: 44px;
  bottom: 16px;
  font-size: 1.6rem;
}

.music-scene .music-note {
  position: absolute;
  color: #7f87d8;
  font-size: 1.4rem;
}

.music-scene .note-a {
  left: 40px;
  top: 28px;
}

.music-scene .note-b {
  left: 68px;
  top: 16px;
}

.center-scene .bubble-a,
.center-scene .bubble-b {
  position: absolute;
  color: #95a2dd;
  font-weight: 700;
}

.center-scene .bubble-a {
  left: 40px;
  top: 20px;
}

.center-scene .bubble-b {
  right: 42px;
  top: 42px;
}

.center-scene .face {
  position: absolute;
  left: 70px;
  bottom: 22px;
  font-size: 1.7rem;
}
</style>
