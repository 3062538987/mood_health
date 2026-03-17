<template>
  <transition name="draft-fade">
    <div v-if="visible" class="draft-overlay" @click.self="emit('close')">
      <div class="draft-card">
        <div class="card-icon">📝</div>
        <p class="eyebrow">检测到未完成草稿</p>
        <h3>要不要从上次停下来的地方继续</h3>
        <p class="description">{{ preview }}</p>

        <div class="meta-row">
          <span>最近保存：{{ savedAtText }}</span>
        </div>

        <div class="actions">
          <button type="button" class="ghost-btn" @click="emit('discard')">放弃草稿</button>
          <button type="button" class="primary-btn" @click="emit('restore')">恢复继续写</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  preview: string
  savedAtText: string
}>()

const emit = defineEmits<{
  close: []
  restore: []
  discard: []
}>()
</script>

<style scoped lang="scss">
.draft-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(32, 36, 71, 0.3);
  backdrop-filter: blur(10px);
}

.draft-card {
  width: min(100%, 440px);
  padding: 1.6rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(32, 36, 71, 0.18);
  border: 1px solid rgba(99, 102, 241, 0.14);
}

.card-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.1);
  font-size: 1.4rem;
}

.eyebrow {
  margin: 1rem 0 0.35rem;
  color: #7c7fb7;
  font-size: 0.84rem;
  font-weight: 700;
}

h3 {
  margin: 0;
  color: #1f2347;
  font-size: 1.3rem;
}

.description {
  margin: 0.8rem 0 0;
  color: #4d5378;
  line-height: 1.75;
}

.meta-row {
  margin-top: 1rem;
  color: #7c83a7;
  font-size: 0.88rem;
}

.actions {
  display: flex;
  justify-content: end;
  gap: 0.8rem;
  margin-top: 1.35rem;
}

.primary-btn,
.ghost-btn {
  min-height: 42px;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}

.primary-btn {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
}

.ghost-btn {
  background: rgba(99, 102, 241, 0.08);
  color: #4e547b;
}

.draft-fade-enter-active,
.draft-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.draft-fade-enter-from,
.draft-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .actions {
    flex-direction: column-reverse;
  }
}
</style>
