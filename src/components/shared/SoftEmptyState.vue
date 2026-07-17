<template>
  <section class="soft-empty-state" :class="{ compact }" :aria-label="title">
    <div class="illustration" aria-hidden="true">
      <div class="ground"></div>
      <div class="cloud cloud-left"></div>
      <div class="cloud cloud-right"></div>
      <div class="diary">
        <div class="diary-cover"></div>
        <div class="diary-page">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <div class="face">
        <span class="eye left"></span>
        <span class="eye right"></span>
        <span class="mouth"></span>
      </div>
    </div>

    <div class="content">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      <button type="button" class="action-button" @click="emit('action')">
        {{ actionText }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    actionText: string
    compact?: boolean
  }>(),
  {
    actionText: '去看看',
    compact: false,
  }
)

const emit = defineEmits<{
  action: []
}>()
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.soft-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 3rem 2rem;
  border-radius: 28px;
  background:
    radial-gradient(circle at top, rgba(243, 166, 131, 0.16), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(252, 247, 242, 0.92));
  border: 1px solid rgba(231, 111, 81, 0.12);
  box-shadow: 0 20px 48px rgba(106, 176, 165, 0.12);
  text-align: center;
}

.soft-empty-state.compact {
  padding: 2.25rem 1.5rem;
  gap: 1rem;
}

.soft-empty-state.compact .illustration {
  width: min(220px, 100%);
  height: 154px;
}

.soft-empty-state.compact h3 {
  font-size: 1.28rem;
}

.soft-empty-state.compact p {
  max-width: 26rem;
}

.soft-empty-state.compact .action-button {
  min-width: 0;
  padding: 0.82rem 1.4rem;
}

.illustration {
  position: relative;
  width: min(280px, 100%);
  height: 200px;
}

.ground {
  position: absolute;
  left: 50%;
  bottom: 10px;
  width: 160px;
  height: 24px;
  border-radius: 999px;
  background: rgba(106, 176, 165, 0.14);
  transform: translateX(-50%);
}

.diary {
  position: absolute;
  left: 50%;
  top: 34px;
  width: 118px;
  height: 140px;
  transform: translateX(-50%);
}

.diary-cover,
.diary-page {
  position: absolute;
  inset: 0;
  border-radius: 28px;
}

.diary-cover {
  background: linear-gradient(135deg, #f6d7c7, #edc1a6);
  transform: rotate(-6deg);
  box-shadow: 0 14px 34px rgba(237, 193, 166, 0.35);
}

.diary-page {
  background: linear-gradient(180deg, #fffefb, #fff3ea);
  border: 1px solid rgba(232, 202, 183, 0.65);
  transform: rotate(4deg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 0 20px;
}

.diary-page span {
  height: 8px;
  border-radius: 999px;
  background: rgba(221, 185, 163, 0.75);
}

.diary-page span:nth-child(2) {
  width: 86%;
}

.diary-page span:nth-child(3) {
  width: 62%;
}

.face {
  position: absolute;
  left: 50%;
  top: 108px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #fff1b8;
  transform: translateX(-50%);
  box-shadow: 0 10px 24px rgba(255, 209, 102, 0.25);
  animation: floatFace 4.2s ease-in-out infinite;
}

.eye,
.mouth {
  position: absolute;
  display: block;
  background: #8b6a58;
}

.eye {
  top: 20px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.eye.left {
  left: 17px;
}

.eye.right {
  right: 17px;
}

.mouth {
  left: 50%;
  bottom: 14px;
  width: 18px;
  height: 9px;
  border-radius: 0 0 18px 18px;
  transform: translateX(-50%);
}

.cloud {
  position: absolute;
  width: 62px;
  height: 24px;
  border-radius: 999px;
  background: #edf5f1;
  box-shadow:
    18px -10px 0 6px #edf5f1,
    42px -4px 0 2px #edf5f1;
  animation: floatCloud 6s ease-in-out infinite;
}

.cloud-left {
  top: 36px;
  left: 10px;
}

.cloud-right {
  top: 24px;
  right: 18px;
  background: #fbf2eb;
  box-shadow:
    18px -10px 0 6px #fbf2eb,
    42px -4px 0 2px #fbf2eb;
  animation-delay: 0.8s;
}

.content {
  max-width: 30rem;
}

h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #4d5f5b;
  font-family: 'Noto Serif SC', serif;
}

p {
  margin: 0.85rem 0 0;
  line-height: 1.8;
  color: #71807d;
  font-size: 0.98rem;
}

.action-button {
  margin-top: 1.5rem;
  min-width: 160px;
  padding: 0.9rem 1.4rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #6ab0a5, #89c6bc);
  color: #fff;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(106, 176, 165, 0.22);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    opacity 0.25s ease;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(106, 176, 165, 0.26);
}

.action-button:active {
  transform: translateY(0);
}

@keyframes floatSmile {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

@keyframes floatFace {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }

  50% {
    transform: translateX(-50%) translateY(-6px);
  }
}

@keyframes floatCloud {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@media (max-width: 768px) {
  .soft-empty-state {
    padding: 2.25rem 1.25rem;
    border-radius: 22px;
  }

  .illustration {
    height: 180px;
  }

  h3 {
    font-size: 1.3rem;
  }
}
</style>
