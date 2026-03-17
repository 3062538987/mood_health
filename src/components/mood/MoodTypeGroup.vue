<template>
  <section class="mood-type-group">
    <div class="section-head">
      <div>
        <p class="eyebrow">情绪类型</p>
        <h3>今天主要是哪几种感受在发声</h3>
      </div>
      <span class="counter">已选 {{ selectedIds.length }}/{{ maxSelect }}</span>
    </div>

    <div class="mood-grid">
      <button
        v-for="item in options"
        :key="item.id"
        type="button"
        class="mood-item"
        :class="{ selected: selectedIds.includes(item.id) }"
        :style="{ '--item-color': item.color, '--item-soft': item.softColor }"
        @click="emit('toggle', item.id)"
      >
        <span class="emoji">{{ item.emoji }}</span>
        <span class="label">{{ item.label }}</span>
        <span class="description">{{ item.description }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MoodTypeOption } from '@/stores/moodRecordStore'

defineProps<{
  options: MoodTypeOption[]
  selectedIds: string[]
  maxSelect?: number
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()
</script>

<style scoped lang="scss">
.mood-type-group {
  display: grid;
  gap: 1rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #7c7fb7;
  font-size: 0.84rem;
  font-weight: 600;
}

h3 {
  margin: 0;
  color: #202447;
  font-size: 1.1rem;
}

.counter {
  color: #70759a;
  font-size: 0.9rem;
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.95rem;
}

.mood-item {
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  background: var(--item-soft);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
  display: grid;
  gap: 0.35rem;
}

.mood-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--item-color) 60%, white);
  box-shadow: 0 14px 28px rgba(99, 102, 241, 0.12);
}

.mood-item.selected {
  background: linear-gradient(135deg, var(--item-color), #818cf8);
  color: #fff;
  transform: scale(1.02);
  box-shadow: 0 18px 32px rgba(99, 102, 241, 0.2);
}

.emoji {
  font-size: 1.4rem;
}

.label {
  font-weight: 700;
  font-size: 1rem;
}

.description {
  font-size: 0.84rem;
  line-height: 1.5;
  color: rgba(32, 36, 71, 0.74);
}

.mood-item.selected .description {
  color: rgba(255, 255, 255, 0.82);
}

@media (max-width: 768px) {
  .section-head {
    align-items: start;
    flex-direction: column;
  }
}
</style>
