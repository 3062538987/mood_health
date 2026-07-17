<template>
  <section class="mood-wheel-group">
    <div class="section-head">
      <div>
        <p class="eyebrow">情绪色环</p>
        <h3>点击或拖动色环，角度选情绪，半径定强度</h3>
      </div>
      <span class="counter">{{ selectedLabel }} · {{ intensity }}/10</span>
    </div>

    <div
      ref="wheelRef"
      class="wheel-stage"
      :class="{ dragging: isDragging }"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @pointerleave="endDrag"
    >
      <div class="wheel-halo"></div>
      <div class="wheel-ring"></div>
      <div class="wheel-glow"></div>
      <div class="wheel-indicator" :style="indicatorStyle"></div>
      <div class="wheel-inner"></div>

      <button type="button" class="wheel-handle" :style="handleStyle" aria-label="当前选中的情绪">
        <span class="handle-core"></span>
      </button>

      <div class="center-card">
        <template v-if="hasSelection">
          <span class="center-emoji">{{ activeMood.emoji }}</span>
          <strong class="center-label">{{ activeMood.label }}</strong>
          <span class="center-intensity">{{ intensity }}/10</span>
          <small class="center-note">{{ intensityTone }}</small>
        </template>
        <template v-else>
          <span class="center-emoji">🌈</span>
          <strong class="center-label">点击色环</strong>
          <span class="center-intensity">选择情绪</span>
          <small class="center-note">角度定情绪，半径定强度</small>
        </template>
      </div>

      <div class="cardinal-label top">0° 开心</div>
      <div class="cardinal-label right">90° 平静</div>
      <div class="cardinal-label bottom">180° 悲伤</div>
      <div class="cardinal-label left">270° 愤怒</div>

      <div class="angle-badge top-right">情绪角度</div>
      <div class="angle-badge bottom-left">强度半径</div>
    </div>

    <p class="wheel-hint">越靠近中心越弱，越靠近外圈越强；拖动到不同角度会切换情绪。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MoodTypeOption } from '@/stores/moodRecordStore'

const props = defineProps<{
  options: MoodTypeOption[]
  selectedMoodId: string
  intensity: number
}>()

const emit = defineEmits<{
  select: [payload: { moodId: string; intensity: number }]
}>()

const wheelRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const outerRadius = 120
const innerRadius = 44

const fallbackMood: MoodTypeOption = {
  id: 'happy',
  label: '开心',
  emoji: '😊',
  description: '轻快明亮的状态。',
  color: '#ef4444',
  softColor: 'rgba(239, 68, 68, 0.12)',
}

const angleMap: Record<string, number> = {
  happy: 0,
  delight: 28,
  excited: 58,
  calm: 90,
  grateful: 126,
  neutral: 162,
  sad: 180,
  tired: 222,
  anxious: 252,
  angry: 270,
  irritable: 322,
}

const moodList = computed(() =>
  props.options.map((item) => ({
    ...item,
    angle: angleMap[item.id] ?? 0,
  }))
)

const moodMap = computed(() => new Map(props.options.map((item) => [item.id, item])))

const normalizeAngle = (value: number) => ((value % 360) + 360) % 360

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getIntensityFromRadius = (distance: number) => {
  const normalized = clamp(distance, innerRadius, outerRadius)
  const ratio = (normalized - innerRadius) / (outerRadius - innerRadius)
  return clamp(Math.round(1 + ratio * 9), 1, 10)
}

const getNearestMoodId = (angle: number) => {
  if (moodList.value.length === 0) {
    return fallbackMood.id
  }

  let nearest = moodList.value[0]
  let minDiff = 360

  moodList.value.forEach((item) => {
    const diff = Math.min(Math.abs(item.angle - angle), 360 - Math.abs(item.angle - angle))
    if (diff < minDiff) {
      minDiff = diff
      nearest = item
    }
  })

  return nearest.id
}

const hasSelection = computed(() => Boolean(props.selectedMoodId && moodMap.value.has(props.selectedMoodId)))

const activeMood = computed(
  () => (hasSelection.value ? moodMap.value.get(props.selectedMoodId) : null) ?? fallbackMood
)

const selectedLabel = computed(() => (hasSelection.value ? activeMood.value.label : '未选择'))

const currentAngle = computed(() => {
  const selectedItem = hasSelection.value ? moodMap.value.get(props.selectedMoodId) : null
  if (!selectedItem) {
    return 0
  }
  return moodList.value.find((item) => item.id === selectedItem.id)?.angle ?? 0
})

const intensityTone = computed(() => {
  if (props.intensity <= 3) {
    return '偏弱'
  }
  if (props.intensity <= 7) {
    return '中等'
  }
  return '偏强'
})

const selectedRadius = computed(
  () => innerRadius + ((clamp(Math.round(props.intensity || 6), 1, 10) - 1) / 9) * (outerRadius - innerRadius)
)

const handleStyle = computed(() => {
  const radian = ((currentAngle.value - 90) * Math.PI) / 180
  const x = Math.cos(radian) * selectedRadius.value
  const y = Math.sin(radian) * selectedRadius.value
  const color = activeMood.value.color || fallbackMood.color

  return {
    '--handle-x': `${x}px`,
    '--handle-y': `${y}px`,
    '--handle-color': color,
    '--handle-opacity': hasSelection.value ? '1' : '0',
  }
})

const indicatorStyle = computed(() => {
  const color = activeMood.value.color || fallbackMood.color
  return {
    '--indicator-angle': `${currentAngle.value}deg`,
    '--indicator-color': color,
    '--indicator-opacity': hasSelection.value ? '1' : '0',
  }
})

const applySelection = (event: PointerEvent | MouseEvent) => {
  const wheelEl = wheelRef.value
  if (!wheelEl) {
    return
  }

  const rect = wheelEl.getBoundingClientRect()
  const x = event.clientX - rect.left - rect.width / 2
  const y = event.clientY - rect.top - rect.height / 2
  const distance = Math.sqrt(x * x + y * y)
  const angle = normalizeAngle((Math.atan2(y, x) * 180) / Math.PI + 90)

  emit('select', {
    moodId: getNearestMoodId(angle),
    intensity: getIntensityFromRadius(distance),
  })
}

const handlePointerDown = (event: PointerEvent) => {
  isDragging.value = true
  wheelRef.value?.setPointerCapture(event.pointerId)
  applySelection(event)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isDragging.value) {
    return
  }
  applySelection(event)
}

const endDrag = (event: PointerEvent) => {
  if (wheelRef.value?.hasPointerCapture(event.pointerId)) {
    wheelRef.value.releasePointerCapture(event.pointerId)
  }
  isDragging.value = false
}
</script>

<style scoped lang="scss">
.mood-wheel-group {
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
  color: #9c8f7d;
  font-size: 0.84rem;
  font-weight: 600;
}

h3 {
  margin: 0;
  color: #5c5c5c;
  font-size: 1.1rem;
}

.counter {
  color: #7a746b;
  font-size: 0.9rem;
  white-space: nowrap;
}

.wheel-stage {
  position: relative;
  width: 240px;
  height: 240px;
  margin: 0 auto;
  border-radius: 50%;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.wheel-stage.dragging {
  cursor: grabbing;
}

.wheel-ring,
.wheel-halo,
.wheel-glow,
.wheel-indicator,
.wheel-inner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.wheel-halo {
  inset: -14px;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.35), transparent 55%);
  filter: blur(8px);
  opacity: 0.8;
  pointer-events: none;
}

.wheel-ring {
  background: conic-gradient(
    from -90deg,
    #ef4444,
    #f97316,
    #facc15,
    #22c55e,
    #3b82f6,
    #a855f7,
    #ef4444
  );
  -webkit-mask: radial-gradient(circle at center, transparent 0 43px, #000 44px 120px, transparent 121px);
  mask: radial-gradient(circle at center, transparent 0 43px, #000 44px 120px, transparent 121px);
}

.wheel-glow {
  inset: 10px;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.26), transparent 62%);
  pointer-events: none;
}

.wheel-indicator {
  left: 50%;
  top: 50%;
  width: 106px;
  height: 2px;
  transform-origin: left center;
  transform: translateY(-50%) rotate(var(--indicator-angle));
  opacity: var(--indicator-opacity);
  pointer-events: none;
}

.wheel-indicator::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--indicator-color) 20%, white), var(--indicator-color));
  box-shadow: 0 0 12px color-mix(in srgb, var(--indicator-color) 45%, transparent);
}

.wheel-inner {
  inset: 52px;
  background: rgba(255, 250, 244, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 10px 20px rgba(115, 92, 68, 0.08);
}

.wheel-handle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--handle-color);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 6px 16px rgba(0, 0, 0, 0.16);
  transform: translate3d(calc(-50% + var(--handle-x)), calc(-50% + var(--handle-y)), 0);
  opacity: var(--handle-opacity);
  pointer-events: none;
}

.handle-core {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
}

.center-card {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 92px;
  height: 92px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(255, 251, 246, 0.95);
  border: 1px solid rgba(233, 220, 204, 0.9);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.1rem;
  padding: 0.35rem;
  z-index: 2;
}

.center-emoji {
  font-size: 1.45rem;
  line-height: 1;
}

.center-label {
  color: #5a5147;
  font-size: 0.96rem;
}

.center-intensity {
  color: #c1783a;
  font-size: 1rem;
  font-weight: 700;
}

.center-note {
  color: #8f8172;
  font-size: 0.72rem;
}

.cardinal-label {
  position: absolute;
  color: #6d655d;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.16rem 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1;
}

.cardinal-label.top {
  left: 50%;
  top: 3px;
  transform: translateX(-50%);
}

.cardinal-label.right {
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
}

.cardinal-label.bottom {
  left: 50%;
  bottom: 3px;
  transform: translateX(-50%);
}

.cardinal-label.left {
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
}

.angle-badge {
  position: absolute;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(220, 206, 190, 0.9);
  background: rgba(255, 252, 248, 0.82);
  color: #8b7d6d;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.04);
}

.angle-badge.top-right {
  top: 10px;
  right: 10px;
}

.angle-badge.bottom-left {
  left: 10px;
  bottom: 10px;
}

.wheel-hint {
  margin: 0;
  color: #8b8176;
  font-size: 0.88rem;
  text-align: center;
}

@media (max-width: 768px) {
  .section-head {
    align-items: start;
    flex-direction: column;
  }
}
</style>
