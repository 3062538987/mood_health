<template>
  <div class="mood-record-page">
    <div class="page-shell">
      <section class="hero-panel">
        <div>
          <p class="eyebrow">Mood Record</p>
          <h1>把今天的情绪，温柔但清楚地记下来</h1>
          <p class="hero-copy">
            先记录情绪，再决定要不要解决它。这里会帮你把感受、触发因素和智能
            建议整理成一条更顺滑的路径。
          </p>
        </div>

        <div class="hero-metrics">
          <article>
            <strong>{{ formProgress }}%</strong>
            <span>记录完成度</span>
          </article>
          <article>
            <strong>{{ selectedMoodMeta.length }}</strong>
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

            <div class="mood-type-list">
              <button
                v-for="item in visibleMoodOptions"
                :key="item.id"
                type="button"
                class="mood-type-item"
                :class="{ active: selectedMoodTypeIds.includes(item.id) }"
                @click="handleMoodTypeSelect(item.id)"
              >
                <span
                  class="mood-emoji"
                  :style="{ backgroundColor: item.softColor, borderColor: item.color }"
                >
                  {{ item.emoji }}
                </span>
                <span class="mood-meta">
                  <span class="mood-label">{{ item.label }}</span>
                  <span class="mood-tag" :style="{ backgroundColor: item.softColor }">
                    {{ getMoodTag(item.id) }}
                  </span>
                </span>
              </button>
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
              placeholder="可以从一件小事开始：今天什么时候开始觉得不舒服，或哪一刻突然轻松了？"
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
                :class="{ success: isSubmittingSuccess }"
                :disabled="!canSubmit"
                @click="handleSubmit"
              >
                {{ isSubmitting ? '正在提交...' : '保存这次情绪记录' }}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMoodRecordStore } from '@/stores/moodRecordStore'

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
  selectedMoodMeta,
  filteredTriggerSuggestions,
  characterCount,
  formProgress,
  draftSavedAtText,
} = storeToRefs(store)

const moodOptions = computed(() => {
  const options = store.moodOptions
  return Array.isArray(options) ? options : []
})

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
  if (selectedMoodMeta.value.length === 0) {
    return '未选择'
  }
  return selectedMoodMeta.value.map((item) => item.label).join('、')
})

const canSubmit = computed(() => !isSubmitting.value)

const fallbackMoodOptions = [
  {
    id: 'happy',
    label: '快乐',
    emoji: '😊',
    color: '#6366f1',
    softColor: 'rgba(99, 102, 241, 0.14)',
  },
  {
    id: 'delight',
    label: '愉悦',
    emoji: '🌤️',
    color: '#8b5cf6',
    softColor: 'rgba(139, 92, 246, 0.14)',
  },
  {
    id: 'neutral',
    label: '一般',
    emoji: '🙂',
    color: '#64748b',
    softColor: 'rgba(100, 116, 139, 0.12)',
  },
  {
    id: 'sad',
    label: '难过',
    emoji: '😔',
    color: '#3b82f6',
    softColor: 'rgba(59, 130, 246, 0.12)',
  },
  {
    id: 'angry',
    label: '愤怒',
    emoji: '😠',
    color: '#ef4444',
    softColor: 'rgba(239, 68, 68, 0.12)',
  },
  {
    id: 'anxious',
    label: '焦虑',
    emoji: '😰',
    color: '#f59e0b',
    softColor: 'rgba(245, 158, 11, 0.12)',
  },
]

const visibleMoodOptions = computed(() => {
  if (Array.isArray(moodOptions.value) && moodOptions.value.length > 0) {
    return moodOptions.value
  }
  return fallbackMoodOptions
})

const handleMoodTypeSelect = (moodId: string) => {
  store.toggleMoodType(moodId)
}

const getMoodTag = (moodId: string) => {
  const tagMap: Record<string, string> = {
    happy: '积极',
    delight: '舒展',
    excited: '高能',
    grateful: '温暖',
    calm: '平衡',
    neutral: '平稳',
    tired: '低能',
    sad: '消耗',
    anxious: '紧绷',
    irritable: '敏感',
    angry: '防御',
  }

  return tagMap[moodId] || '状态'
}

const handleSubmit = async () => {
  console.log('点击了保存按钮')
  await store.submitRecord()
}

onMounted(() => {
  store.initializePage()
})
</script>

<style scoped lang="scss">
.mood-record-page {
  min-height: 100%;
  padding: 36px;
  background: #fdf8f2;
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
  border: 1px solid #eee5d8;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.hero-panel {
  padding: 2rem;
  display: grid;
  gap: 1.4rem;
  grid-template-columns: 1.5fr 1fr;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: #9c8f7d;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #5c5c5c;
}

h1 {
  font-size: clamp(1.9rem, 3vw, 2.6rem);
  line-height: 1.2;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.hero-copy {
  margin: 0.8rem 0 0;
  max-width: 46rem;
  color: #5c5c5c;
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
  background: linear-gradient(180deg, rgba(196, 154, 108, 0.1), rgba(255, 255, 255, 0.92));
}

.hero-metrics strong {
  font-size: 1.5rem;
  color: #8b9dc3;
}

.hero-metrics span {
  color: #7a746b;
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

.panel {
  padding: 1.65rem;
}

.mood-type-panel {
  display: grid;
  gap: 1rem;
}

.mood-type-list {
  display: flex;
  gap: 0.58rem;
  overflow-x: auto;
  padding: 0.2rem 0.1rem 0.4rem;
  scrollbar-width: thin;
}

.mood-type-item {
  min-width: 128px;
  border: 1px solid #e8e2d8;
  border-radius: 16px;
  background: #fffdf9;
  color: #5c5c5c;
  padding: 0.5rem 0.58rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.mood-type-item:hover {
  transform: translateY(-1px);
  border-color: #d4c5b3;
}

.mood-type-item.active {
  border-color: #c49a6c;
  background: linear-gradient(180deg, rgba(252, 244, 234, 0.95), rgba(255, 255, 255, 0.98));
  box-shadow: 0 8px 18px rgba(196, 154, 108, 0.2);
}

.mood-emoji {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 1.04rem;
  background: #f8f3ea;
  border: 1px solid #ece2d3;
}

.mood-meta {
  min-width: 0;
  display: grid;
  justify-items: start;
  gap: 0.2rem;
}

.mood-label {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
}

.mood-tag {
  padding: 0.09rem 0.42rem;
  border-radius: 999px;
  background: rgba(139, 157, 195, 0.14);
  color: #6d7280;
  font-size: 12px;
  line-height: 1.25;
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
  background: rgba(139, 157, 195, 0.12);
  color: #5c5c5c;
}

.intensity-badge.low {
  background: rgba(148, 163, 184, 0.16);
}

.intensity-badge.mid {
  background: rgba(139, 157, 195, 0.12);
}

.intensity-badge.high {
  background: rgba(196, 154, 108, 0.16);
}

.intensity-badge strong {
  font-size: 1.35rem;
}

.intensity-badge small,
.scale-labels,
.ai-entry-row p,
.draft-banner small {
  color: #888;
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
  background: rgba(196, 154, 108, 0.12);
  color: #6f6a62;
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
  background: rgba(139, 157, 195, 0.24);
  color: #5c5c5c;
}

.scale-dot.current {
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.intensity-slider {
  width: 100%;
  accent-color: #c49a6c;
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
  border: 1px solid #e8e2d8;
  background: #fff;
  color: #5c5c5c;
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
  color: #888;
}

textarea:focus,
.trigger-input:focus {
  border-color: #c49a6c;
  box-shadow: 0 0 0 4px rgba(196, 154, 108, 0.12);
  background: #fff;
}

.count-chip {
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  background: rgba(196, 154, 108, 0.14);
  color: #888;
  font-size: 12px;
}

.inline-draft-tip {
  margin-bottom: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: #f6f7f9;
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
  color: #555;
  font-size: 12px;
}

.tip-text small {
  color: #888;
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
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
}

.tip-btn.ghost {
  font-weight: 400;
  color: #6f6a62;
  background: rgba(196, 154, 108, 0.16);
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
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
  font-weight: 700;
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.add-trigger-btn {
  font-weight: 700;
}

.inline-ai-btn.loading,
.submit-action:disabled {
  opacity: 0.75;
}

.auto-recommend-list {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  align-items: center;
}

.tip-label {
  color: #888;
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
  background: rgba(196, 154, 108, 0.14);
  color: #5c5c5c;
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
  background: rgba(139, 157, 195, 0.2);
  color: #5c5c5c;
  font-weight: 400;
}

.selected-trigger span {
  margin-left: 0.35rem;
}

.draft-banner {
  display: none;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: #f6f7f9;
  font-size: 12px;
}

.eyebrow {
  color: #888;
  font-size: 13px;
}

.draft-banner.visible {
  display: grid;
  gap: 0.2rem;
}

.ghost-action {
  background: rgba(196, 154, 108, 0.16);
}

.submit-action.success {
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
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
  color: #2c3e50 !important;
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
  color: #95a5a6 !important;
  line-height: 1.4 !important;
  margin-bottom: 0 !important;
}

.panel-head {
  border-bottom: 1px solid #eceff1 !important;
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
  color: #95a5a6 !important;
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
  color: #8b9dc3 !important;
}

textarea {
  font-size: 16px !important;
  padding: 14px !important;
}

textarea::placeholder {
  font-size: 14px !important;
  color: #bbb !important;
}

.inline-draft-tip,
.draft-banner {
  background: #f8f9fa !important;
  border-radius: 16px !important;
  padding: 12px !important;
  border: none !important;
}

.tip-text strong,
.tip-text small,
.draft-banner,
.draft-banner small {
  font-size: 12px !important;
}

.submit-action {
  background: linear-gradient(135deg, #8b9dc3, #c49a6c) !important;
  color: #fff !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  border-radius: 40px !important;
}

.tip-actions .tip-btn,
.tip-actions .tip-btn.ghost {
  background: transparent !important;
  border: 1px solid #d0d7de !important;
  color: #4b5563 !important;
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
}
</style>
