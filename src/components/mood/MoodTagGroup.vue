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
  color: #9c8f7d;
  font-size: 0.84rem;
  font-weight: 600;
}

h3 {
  margin: 0;
  color: #5c5c5c;
  font-size: 1.08rem;
}

.counter {
  color: #7a746b;
  font-size: 0.9rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.95rem;
}

.tag-chip {
  min-height: 44px;
  padding: 0.78rem 1.12rem;
  border-radius: 999px;
  border: 1px solid #e8e2d8;
  background: #fbf4ea;
  color: #5c5c5c;
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
  background: #f6ead9;
}

.tag-chip.selected {
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  transform: scale(1.03);
}

@media (max-width: 768px) {
  .section-head {
    align-items: start;
    flex-direction: column;
  }
}
</style>
