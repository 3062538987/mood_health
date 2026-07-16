<template>
  <section class="soft-loading-state" :class="variantClass" :aria-label="title">
    <div v-if="title || description" class="loading-copy">
      <h3 v-if="title">{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </div>

    <div v-if="variant === 'cards'" class="card-grid">
      <div
        v-for="index in itemCount"
        :key="index"
        class="loading-card shimmer-surface"
        :class="index % 3 === 0 ? 'wide' : 'compact'"
      >
        <div class="badge shimmer-block"></div>
        <div class="dot-row">
          <span class="shimmer-block"></span>
          <span class="shimmer-block"></span>
          <span class="shimmer-block"></span>
        </div>
        <div class="line long shimmer-block"></div>
        <div class="line medium shimmer-block"></div>
        <div class="pill shimmer-block"></div>
      </div>
    </div>

    <div v-else class="panel-stack">
      <div class="loading-panel shimmer-surface">
        <div class="chart shimmer-block"></div>
        <div class="line long shimmer-block"></div>
        <div class="line medium shimmer-block"></div>
      </div>

      <div v-if="itemCount > 1" class="insight-grid">
        <div v-for="index in itemCount - 1" :key="index" class="insight-card shimmer-surface">
          <div class="icon shimmer-block"></div>
          <div class="line long shimmer-block"></div>
          <div class="line short shimmer-block"></div>
          <div class="pill shimmer-block"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    variant?: 'cards' | 'panel'
    itemCount?: number
  }>(),
  {
    title: '正在整理你的情绪内容',
    description: '界面会以更轻柔的方式出现，请稍等一下。',
    variant: 'panel',
    itemCount: 3,
  }
)

const variantClass = computed(() => `variant-${props.variant}`)
</script>

<style scoped lang="scss">
.soft-loading-state {
  padding: 1rem 0;
}

.loading-copy {
  text-align: center;
  margin-bottom: 1.5rem;
}

h3 {
  margin: 0;
  color: #526662;
  font-size: 1.3rem;
  font-family: 'Noto Serif SC', serif;
}

p {
  margin: 0.75rem auto 0;
  max-width: 34rem;
  color: #7d8c89;
  line-height: 1.7;
  font-size: 0.96rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.loading-card,
.loading-panel,
.insight-card {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(247, 241, 236, 0.92));
  box-shadow: 0 14px 36px rgba(106, 176, 165, 0.08);
}

.shimmer-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: shimmer 1.7s linear infinite;
}

.loading-card {
  min-height: 220px;
  padding: 22px;
}

.loading-card.wide {
  min-height: 248px;
}

.badge {
  width: 58px;
  height: 58px;
  margin-left: auto;
  border-radius: 18px;
}

.dot-row {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.dot-row span {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.line {
  height: 16px;
  margin-top: 16px;
  border-radius: 999px;
}

.line.long {
  width: 72%;
  margin-top: 28px;
}

.line.medium {
  width: 54%;
}

.line.short {
  width: 48%;
}

.pill {
  width: 42%;
  height: 38px;
  margin-top: 24px;
  border-radius: 999px;
}

.panel-stack {
  display: grid;
  gap: 18px;
}

.loading-panel {
  padding: 24px;
}

.chart {
  height: 220px;
  border-radius: 20px;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}

.insight-card {
  padding: 20px;
}

.icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  margin-bottom: 18px;
}

.shimmer-block {
  background: linear-gradient(90deg, #e9dfd6, #f8efe8, #e9dfd6);
  background-size: 200% 100%;
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes pulse {
  0%,
  100% {
    background-position: 0% 50%;
    opacity: 0.88;
  }

  50% {
    background-position: 100% 50%;
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .card-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .loading-panel {
    padding: 18px;
  }

  .chart {
    height: 180px;
  }
}
</style>
