<template>
  <section class="mood-tag-group">
    <div class="section-head">
      <div>
        <p class="eyebrow">情绪标签</p>
        <h3>{{ title }}</h3>
      </div>
      <span class="counter">{{ selectedTags.length }} 已选择</span>
    </div>

    <div class="tag-list">
      <button
        v-for="tag in tags"
        :key="tag"
        type="button"
        class="tag-chip"
        :class="{ selected: selectedTags.includes(tag) }"
        @click="emit('toggle', tag)"
      >
        {{ tag }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    tags: string[]
    selectedTags: string[]
  }>(),
  {
    title: '给这段心情补几枚标签',
  }
)

const emit = defineEmits<{
  toggle: [tag: string]
}>()
</script>

<style scoped lang="scss">
.mood-tag-group {
  display: grid;
  gap: 1rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-size: 1.08rem;
}

.counter {
  color: #70759a;
  font-size: 0.9rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.tag-chip {
  min-height: 42px;
  padding: 0.72rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.16);
  background: rgba(99, 102, 241, 0.07);
  color: #4f5479;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.tag-chip:hover {
  transform: translateY(-1px);
  background: rgba(99, 102, 241, 0.12);
}

.tag-chip.selected {
  background: linear-gradient(135deg, #6366f1, #7c83ff);
  color: #fff;
  box-shadow: 0 12px 22px rgba(99, 102, 241, 0.2);
  transform: scale(1.03);
}

@media (max-width: 768px) {
  .section-head {
    align-items: start;
    flex-direction: column;
  }
}
</style>
