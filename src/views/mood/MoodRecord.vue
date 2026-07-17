<template>
  <div v-if="pageLoading" class="loading-wrapper">
    <el-skeleton :rows="8" animated />
  </div>
  <el-empty v-else-if="pageError" description="加载失败，请稍后重试">
    <el-button type="primary" @click="loadPageData">重新加载</el-button>
  </el-empty>
  <div v-else class="mood-record-page">
    <div class="page-shell">
      <section class="hero-panel">
        <div>
          <p class="eyebrow">Mood Record</p>
          <h1>把今天的情绪，温柔但清楚地记下来</h1>
          <p class="hero-copy">
            先记录情绪，再决定要不要解决它。这里会帮你把感受、触发因素和个人
            记录整理成一条更清楚的路径。
          </p>
        </div>

        <div class="hero-metrics">
          <article>
            <strong>{{ formProgress }}%</strong>
            <span>记录完成度</span>
          </article>
          <article>
            <strong>{{ selectedMoodTypeIds.length }}</strong>
            <span>已选情绪</span>
          </article>
          <article>
            <strong>{{ selectedTriggers.length }}</strong>
            <span>触发因素</span>
          </article>
        </div>
      </section>

      <div class="content-grid">
        <main class="editor-column">
          <section class="panel mood-type-panel">
            <div class="panel-head compact">
              <div>
                <p class="eyebrow">情绪类型</p>
                <h2>可组合选择最多 3 种情绪类型</h2>
              </div>
              <span class="count-chip"
                >已选 {{ selectedMoodTypeIds.length }}/3：{{ selectedMoodLabelText }}</span
              >
            </div>

            <div class="mood-grid-scroll">
              <div v-for="row in visibleMoodRows" :key="row.key" class="mood-row-block">
                <p class="mood-row-title">{{ row.title }}</p>
                <div class="mood-grid">
                  <button
                    v-for="item in row.options"
                    :key="item.id"
                    type="button"
                    class="mood-type-item"
                    :class="{
                      active: selectedMoodTypeIds.includes(item.id),
                      disabled: isMoodDisabled(item.id),
                    }"
                    :disabled="isMoodDisabled(item.id)"
                    :aria-label="`选择情绪 ${getMoodLabel(item.id)}`"
                    :style="getMoodCardStyle(item.softColor)"
                    @click="handleMoodTypeSelect(item.id)"
                  >
                    <span class="mood-emoji">
                      {{ item.emoji }}
                    </span>
                    <span class="mood-label">{{ getMoodLabel(item.id) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="panel intensity-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">情绪强度</p>
                <h2>今天的情绪能量大概在哪个刻度</h2>
              </div>
              <div class="intensity-badge" :class="intensityTone.className">
                <span>{{ intensityTone.emoji }}</span>
                <strong>{{ intensity }}/10</strong>
                <small>{{ intensityTone.label }}</small>
              </div>
            </div>

            <div class="intensity-scale" role="list" aria-label="情绪强度刻度">
              <button
                v-for="level in 10"
                :key="level"
                type="button"
                class="scale-dot"
                :class="{
                  active: level <= intensity,
                  current: level === intensity,
                }"
                @click="intensity = level"
              >
                {{ level }}
              </button>
            </div>

            <input
              v-model.number="intensity"
              class="intensity-slider"
              type="range"
              min="1"
              max="10"
            />

            <div class="scale-labels">
              <span>低落</span>
              <span>平稳</span>
              <span>高能量</span>
            </div>
          </section>

          <section class="panel writing-panel">
            <div class="panel-head compact">
              <div>
                <p class="eyebrow">情绪描述</p>
                <h2>先说说，今天发生了什么</h2>
              </div>
              <span class="count-chip">{{ characterCount }}/300</span>
            </div>

            <div v-if="hasDraft" class="inline-draft-tip">
              <div class="tip-text">
                <strong>检测到未完成草稿</strong>
                <small>最近保存：{{ draftSavedAtText }}，可随时恢复，不会打断当前输入。</small>
              </div>
              <div class="tip-actions">
                <button type="button" class="tip-btn ghost" @click="store.discardDraft">
                  放弃草稿
                </button>
                <button type="button" class="tip-btn" @click="store.restoreDraft">恢复草稿</button>
              </div>
            </div>

            <textarea
              v-model="moodContent"
              rows="6"
              placeholder="从一件小事开始：今天什么时候开始觉得不舒服？"
            ></textarea>
          </section>

          <section class="panel trigger-panel">
            <div class="panel-head compact">
              <div>
                <p class="eyebrow">触发因素</p>
                <h2>给今天的情绪加几个关键词</h2>
              </div>
            </div>

            <div class="trigger-box">
              <input
                v-model="triggerInput"
                class="trigger-input"
                type="text"
                placeholder="比如：考试、熬夜、家庭、朋友、工作..."
                @keydown.enter.prevent="store.addTrigger(triggerInput)"
              />
              <button type="button" class="add-trigger-btn" @click="store.addTrigger(triggerInput)">
                添加
              </button>
            </div>

            <div v-if="filteredTriggerSuggestions.length > 0" class="trigger-suggestion-row">
              <button
                v-for="item in filteredTriggerSuggestions"
                :key="item"
                type="button"
                class="suggestion-chip"
                @click="store.addTrigger(item)"
              >
                + {{ item }}
              </button>
            </div>

            <div v-if="selectedTriggers.length > 0" class="selected-trigger-list">
              <button
                v-for="item in selectedTriggers"
                :key="item"
                type="button"
                class="selected-trigger"
                @click="store.removeTrigger(item)"
              >
                {{ item }}
                <span>×</span>
              </button>
            </div>
          </section>

          <section class="panel action-panel">
            <div class="draft-banner" :class="{ visible: hasDraft }">
              <span>草稿已自动保存</span>
              <small>如果中途离开，这段内容会在 24 小时内等你回来。</small>
            </div>

            <div class="action-row">
              <button
                type="button"
                class="submit-action"
                :class="{
                  success: isSubmittingSuccess,
                  loading: isSubmitting,
                }"
                :disabled="!canSubmit"
                @click="handleSubmit"
              >
                <span v-if="isSubmitting" class="submit-spinner"></span>
                {{ isSubmitting ? '正在提交...' : '保存这次情绪记录' }}
              </button>
            </div>
          </section>
        </main>

        <aside class="insight-column">
          <MoodAlert />
          <MoodComparison />
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { EMOTION_MAP } from '@/constants/emotions'
import { useMoodRecordStore } from '@/stores/moodRecordStore'
import MoodComparison from '@/components/mood/MoodComparison.vue'
import MoodAlert from '@/components/mood/MoodAlert.vue'

const pageLoading = ref(true)
const pageError = ref(false)

const store = useMoodRecordStore()

const {
  selectedMoodTypes,
  moodContent,
  intensity,
  triggerInput,
  selectedTriggers,
  hasDraft,
  isSubmitting,
  isSubmittingSuccess,
  canSubmit,
  filteredTriggerSuggestions,
  characterCount,
  formProgress,
  draftSavedAtText,
} = storeToRefs(store)

interface MoodRingOption {
  id: string
  emoji: string
  softColor: string
}

interface MoodRingRow {
  key: string
  title: string
  options: MoodRingOption[]
}

const visibleMoodRows: MoodRingRow[] = [
  {
    key: 'strong',
    title: '强烈情绪',
    options: [
      { id: 'ecstasy', emoji: '😆', softColor: '#f4c862' },
      { id: 'admiration', emoji: '👏', softColor: '#2fd59e' },
      { id: 'fear', emoji: '😨', softColor: '#1aa98c' },
      { id: 'amazement', emoji: '😲', softColor: '#2f82d8' },
      { id: 'grief', emoji: '😢', softColor: '#5a58bb' },
      { id: 'disgust', emoji: '🤢', softColor: '#c35ec9' },
      { id: 'angry', emoji: '😠', softColor: '#ef6a95' },
      { id: 'vigilance', emoji: '👀', softColor: '#f39a61' },
    ],
  },
  {
    key: 'compound',
    title: '复合情绪',
    options: [
      { id: 'delight', emoji: '😊', softColor: '#f3d57f' },
      { id: 'trust', emoji: '🤝', softColor: '#5ae2bb' },
      { id: 'terror', emoji: '😖', softColor: '#31ba8a' },
      { id: 'surprise', emoji: '🎉', softColor: '#4ea9ef' },
      { id: 'sad', emoji: '😔', softColor: '#8a73ce' },
      { id: 'loathing', emoji: '🙅', softColor: '#d285cf' },
      { id: 'rage', emoji: '😤', softColor: '#f08aac' },
      { id: 'anticipation', emoji: '🤩', softColor: '#f7b88f' },
    ],
  },
  {
    key: 'basic',
    title: '基础情绪',
    options: [
      { id: 'calm', emoji: '😌', softColor: '#efe1b2' },
      { id: 'acceptance', emoji: '🤗', softColor: '#8ee7cd' },
      { id: 'apprehension', emoji: '😟', softColor: '#9dd7bd' },
      { id: 'distraction', emoji: '🎮', softColor: '#94c8ef' },
      { id: 'pensiveness', emoji: '🤔', softColor: '#b8abdf' },
      { id: 'boredom', emoji: '😑', softColor: '#deb0d9' },
      { id: 'annoyance', emoji: '😣', softColor: '#f7b7cb' },
      { id: 'interest', emoji: '🔍', softColor: '#f3c8b3' },
    ],
  },
]

const intensityTone = computed(() => {
  if (intensity.value <= 3) {
    return { emoji: '🌧️', label: '偏低能量', className: 'low' }
  }
  if (intensity.value <= 7) {
    return { emoji: '🌤️', label: '中段平衡', className: 'mid' }
  }
  return { emoji: '✨', label: '高能量', className: 'high' }
})

const selectedMoodTypeIds = computed(() => selectedMoodTypes.value)

const selectedMoodLabelText = computed(() => {
  if (selectedMoodTypeIds.value.length === 0) {
    return '未选择'
  }
  return selectedMoodTypeIds.value.map((id) => getMoodLabel(id)).join('、')
})

const getMoodLabel = (moodId: string) => {
  return EMOTION_MAP[moodId] || moodId
}

const toRgb = (hexColor: string) => {
  const hex = hexColor.replace('#', '')
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return { r, g, b }
}

const getMoodCardStyle = (hexColor: string) => {
  const { r, g, b } = toRgb(hexColor)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  const ink = luminance < 0.56 ? '#ffffff' : '#24313f'

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.42)`,
    color: ink,
    '--mood-glow': `rgba(${r}, ${g}, ${b}, 0.3)`,
    '--mood-emoji-bg': `rgba(${r}, ${g}, ${b}, ${luminance < 0.56 ? 0.2 : 0.3})`,
    '--mood-emoji-border': `rgba(${r}, ${g}, ${b}, ${luminance < 0.56 ? 0.42 : 0.32})`,
  }
}

const handleMoodTypeSelect = (moodId: string) => {
  if (selectedMoodTypeIds.value.length >= 3 && !selectedMoodTypeIds.value.includes(moodId)) {
    return
  }
  store.toggleMoodType(moodId)
}

const isMoodDisabled = (moodId: string) => {
  return selectedMoodTypeIds.value.length >= 3 && !selectedMoodTypeIds.value.includes(moodId)
}

const handleSubmit = async () => {
  console.log('点击了保存按钮')
  await store.submitRecord()
}

const loadPageData = async () => {
  pageLoading.value = true
  pageError.value = false
  try {
    await store.initializePage()
  } catch {
    pageError.value = true
  } finally {
    pageLoading.value = false
  }
}

onMounted(() => {
  loadPageData()
})
</script>

<style scoped lang="scss">
.loading-wrapper {
  min-height: 100%;
  padding: 36px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.mood-record-page {
  min-height: 100%;
  padding: 36px;
  background: var(--bg-color);
}

.page-shell {
  width: min(1200px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 1.6rem;
}

.hero-panel,
.panel {
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.hero-panel {
  padding: 2rem;
  display: grid;
  gap: 1.4rem;
  grid-template-columns: 1.5fr 1fr;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: var(--text-color);
  font-family: var(--font-display);
}

h1 {
  font-size: clamp(1.9rem, 3vw, 2.6rem);
  line-height: 1.2;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color);
}

.hero-copy {
  margin: 0.8rem 0 0;
  max-width: 46rem;
  color: var(--text-color);
  line-height: 1.8;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
}

.hero-metrics article {
  display: grid;
  align-content: center;
  gap: 0.28rem;
  padding: 1rem;
  border-radius: 20px;
  background: var(--surface-muted);
}

.hero-metrics strong {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.hero-metrics span {
  color: var(--muted);
  font-size: 0.9rem;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.editor-column {
  display: grid;
  gap: 1.4rem;
}

.insight-column {
  min-width: 0;
}

.panel {
  padding: 1.65rem;
}

.mood-type-panel {
  display: grid;
  gap: 1rem;
}

.mood-grid-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  padding-bottom: 0.25rem;
}

.mood-row-block {
  margin-bottom: 0.7rem;
}

.mood-row-block:last-child {
  margin-bottom: 0;
}

.mood-row-title {
  margin: 0 0 0.42rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
}

.mood-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;

    @media (max-width: 640px) {
      grid-template-columns: repeat(3, minmax(64px, 1fr));
      gap: 0.4rem;
    }
  }

.mood-type-item {
  min-height: 92px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--surface-muted);
  color: var(--text-color);
  padding: 0.55rem 0.4rem;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.35rem;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.mood-type-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px var(--mood-glow, var(--primary-soft-bg));
}

.mood-type-item.active {
  border-color: var(--primary-color);
  box-shadow:
    0 10px 20px var(--mood-glow, var(--primary-soft-bg)),
    inset 0 0 0 1px rgba(255, 255, 255, 0.7);
}

.mood-type-item.disabled {
  opacity: 0.44;
  filter: grayscale(0.38);
  cursor: not-allowed;
  transform: none;
}

.mood-emoji {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 28px;
  line-height: 1;
  box-shadow: none;
  background: transparent;
}

.mood-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1rem;
}

.panel-head.compact {
  align-items: center;
}

.intensity-panel {
  display: grid;
  gap: 1rem;
}

.intensity-badge {
  min-width: 116px;
  padding: 0.8rem 0.9rem;
  border-radius: 20px;
  display: grid;
  justify-items: center;
  background: var(--primary-soft-bg);
  color: var(--text-color);
}

.intensity-badge.low {
  background: var(--surface-muted);
}

.intensity-badge.mid {
  background: var(--primary-soft-bg);
}

.intensity-badge.high {
  background: var(--primary-soft-bg);
}

.intensity-badge strong {
  font-size: 1.35rem;
}

.intensity-badge small,
.scale-labels,
.ai-entry-row p,
.draft-banner small {
  color: var(--muted);
  font-size: 13px;
}

.intensity-scale {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 0.45rem;
}

.scale-dot {
  min-height: 44px;
  border: none;
  border-radius: 16px;
  background: var(--primary-soft-bg);
  color: var(--text-color);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.scale-dot.active {
  background: var(--primary-soft-bg);
  color: var(--text-color);
}

.scale-dot.current {
  background: var(--primary-color);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.intensity-slider {
  width: 100%;
  accent-color: var(--primary-color);
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

textarea,
.trigger-input {
  width: 100%;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  color: var(--text-color);
  padding: 1.15rem 1.2rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

textarea {
  resize: vertical;
  min-height: 156px;
  font-size: 15px;
  line-height: 1.75;
}

textarea::placeholder {
  font-size: 15px;
  color: var(--muted);
}

textarea:focus,
.trigger-input:focus {
  border-color: var(--focus);
  box-shadow: 0 0 0 4px var(--primary-soft-bg);
  background: var(--surface);
}

.count-chip {
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  background: var(--primary-soft-bg);
  color: var(--muted);
  font-size: 12px;
}

.inline-draft-tip {
  margin-bottom: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.tip-text {
  display: grid;
  gap: 0.2rem;
}

.tip-text strong {
  color: var(--text-color);
  font-size: 12px;
}

.tip-text small {
  color: var(--muted);
  font-size: 12px;
}

.tip-actions {
  display: flex;
  gap: 0.55rem;
}

.tip-btn {
  border: none;
  border-radius: 40px;
  padding: 0.52rem 0.78rem;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--primary-color);
}

.tip-btn.ghost {
  font-weight: 400;
  color: var(--text-color);
  background: var(--primary-soft-bg);
}

.ai-entry-row {
  margin-top: 0.95rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: center;
}

.inline-ai-btn,
.add-trigger-btn,
.ghost-action,
.submit-action,
.auto-pill,
.suggestion-chip,
.selected-trigger {
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 400;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.inline-ai-btn,
.submit-action {
  padding: 0.95rem 1.3rem;
  border-radius: 40px;
  background: var(--primary-color);
  font-weight: 700;
  color: #fff;
  box-shadow: var(--shadow-sm);
}

.add-trigger-btn {
  font-weight: 700;
}

.inline-ai-btn.loading,
.submit-action:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  filter: grayscale(0.35);
  box-shadow: none;
}

.submit-action:disabled:hover {
  transform: none;
}

.auto-recommend-list {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  align-items: center;
}

.tip-label {
  color: var(--muted);
  font-weight: 400;
  font-size: 13px;
}

.auto-pill,
.suggestion-chip,
.selected-trigger,
.ghost-action,
.add-trigger-btn {
  padding: 0.74rem 0.95rem;
  border-radius: 999px;
  background: var(--primary-soft-bg);
  color: var(--text-color);
}

.auto-pill:hover,
.suggestion-chip:hover,
.selected-trigger:hover,
.ghost-action:hover,
.inline-ai-btn:hover,
.submit-action:hover,
.add-trigger-btn:hover {
  transform: translateY(-1px);
}

.trigger-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.7rem;
}

.trigger-suggestion-row,
.selected-trigger-list,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.selected-trigger {
  background: var(--primary-soft-bg);
  color: var(--text-color);
  font-weight: 400;
}

.selected-trigger span {
  margin-left: 0.35rem;
}

.draft-banner {
  display: none;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
  font-size: 12px;
}

.eyebrow {
  color: var(--muted);
  font-size: 13px;
}

.draft-banner.visible {
  display: grid;
  gap: 0.2rem;
}

.ghost-action {
  background: var(--primary-soft-bg);
}

.submit-action.success {
  background: var(--success-color);
}

.submit-action.loading {
  pointer-events: none;
  opacity: 0.72;
}

.submit-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.el-message--error) {
  background: #fff6ec;
  border-color: #f0d3ad;
}

:deep(.el-message--error .el-message__content) {
  color: #8a6a47;
}

.soft-fade-enter-active,
.soft-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.soft-fade-enter-from,
.soft-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Visual hierarchy overrides */
.editor-column {
  gap: 0 !important;
}

.editor-column > .panel {
  margin-bottom: 28px !important;
}

.editor-column > .panel:last-of-type {
  margin-bottom: 0 !important;
}

.mood-type-panel .eyebrow,
.intensity-panel .eyebrow,
.writing-panel .eyebrow,
.trigger-panel .eyebrow {
  font-size: 20px !important;
  font-weight: 700 !important;
  color: var(--text-color) !important;
  margin-bottom: 12px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  line-height: 1.2 !important;
}

.mood-type-panel h2,
.intensity-panel h2,
.writing-panel h2,
.trigger-panel h2 {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--muted) !important;
  line-height: 1.4 !important;
  margin-bottom: 0 !important;
}

.panel-head {
  border-bottom: 1px solid var(--border-color) !important;
  padding-bottom: 12px !important;
  margin-bottom: 12px !important;
}

.eyebrow,
.hero-copy,
.scale-labels,
.count-chip,
.tip-text small,
.draft-banner small,
.tip-label {
  font-size: 13px !important;
  color: var(--muted) !important;
  line-height: 1.4 !important;
}

.mood-type-item {
  font-size: 16px !important;
  font-weight: 500 !important;
  padding: 10px 16px !important;
}

.mood-label {
  font-size: 16px !important;
  font-weight: 500 !important;
}

.intensity-badge strong {
  font-size: 20px !important;
  font-weight: 700 !important;
  color: var(--primary-color) !important;
}

textarea {
  font-size: 16px !important;
  padding: 14px !important;
}

textarea::placeholder {
  font-size: 14px !important;
  color: var(--muted) !important;
}

.inline-draft-tip,
.draft-banner {
  background: var(--surface-muted) !important;
  border-radius: 16px !important;
  padding: 12px !important;
  border: 1px solid var(--border-color) !important;
}

.tip-text strong,
.tip-text small,
.draft-banner,
.draft-banner small {
  font-size: 12px !important;
}

.submit-action {
  background: var(--primary-color) !important;
  color: #fff !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  border-radius: 40px !important;
}

.tip-actions .tip-btn,
.tip-actions .tip-btn.ghost {
  background: transparent !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-color) !important;
  font-size: 14px !important;
  font-weight: 400 !important;
}

@media (max-width: 1024px) {
  .content-grid,
  .hero-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .mood-record-page {
    padding: 18px;
    padding-bottom: 120px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .panel-head,
  .trigger-box,
  .action-row,
  .inline-draft-tip {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .intensity-scale {
    grid-template-columns: repeat(5, 1fr);
  }

  .mood-type-list {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }

  .mood-grid {
    min-width: 740px;
  }

  .action-panel {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 30;
    padding: 14px;
    border-radius: 20px 20px 18px 18px;
    box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.08);
  }

  .action-row {
    width: 100%;
  }

  .submit-action {
    width: 100%;
    min-height: 48px;
  }
}
</style>
