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
              ref="moodTextareaRef"
              v-model="moodContent"
              rows="6"
              placeholder="可以从一件小事开始：今天什么时候开始觉得不舒服，或哪一刻突然轻松了？"
            ></textarea>

            <div class="ai-entry-row">
              <button
                type="button"
                class="inline-ai-btn"
                :class="{ loading: aiLoading }"
                @click="handleGenerateAdvice"
              >
                {{ aiLoading ? '正在整理建议...' : '先帮我梳理一下' }}
              </button>
              <p>按钮前置在描述区下方，写完就能立刻得到回应。</p>
            </div>

            <transition name="soft-fade" mode="out-in">
              <div v-if="autoRecommendations.length > 0" class="auto-recommend-list">
                <span class="tip-label">系统已根据你的输入做了预匹配</span>
                <button
                  v-for="item in autoRecommendations"
                  :key="item"
                  type="button"
                  class="auto-pill"
                  @click="appendRecommendation(item)"
                >
                  {{ item }}
                </button>
              </div>
            </transition>
          </section>

          <section class="panel">
            <MoodTypeGroup
              :options="moodOptions"
              :selected-ids="selectedMoodTypes"
              :max-select="3"
              @toggle="store.toggleMoodType"
            />
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

          <section class="panel">
            <MoodTagGroup
              :tags="tagOptions"
              :selected-tags="selectedTags"
              @toggle="store.toggleTag"
            />
          </section>

          <section class="panel action-panel">
            <div class="draft-banner" :class="{ visible: hasDraft }">
              <span>草稿已自动保存</span>
              <small>如果中途离开，这段内容会在 24 小时内等你回来。</small>
            </div>

            <div class="action-row">
              <button type="button" class="ghost-action" @click="store.resetForm">
                清空当前记录
              </button>
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

        <aside class="ai-column">
          <AiSuggestCard
            :loading="aiLoading"
            :history-loading="historyLoading"
            :can-generate="canAskAi"
            :service-unavailable="isAiTemporarilyDisabled"
            :disabled-seconds="aiCooldownSeconds"
            :service-message="aiServiceMessage"
            :result="aiResult"
            :auto-recommendations="autoRecommendations"
            :history="aiHistory"
            :mood-meta="currentAiMoodMeta"
            @generate="handleGenerateAdvice"
            @copy="handleCopyAdvice"
            @apply-all="handleApplyAllTriggers"
            @apply-one="handleApplySingleTrigger"
            @use-history="store.hydrateAdviceFromHistory"
          />
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import AiSuggestCard from '@/components/mood/AiSuggestCard.vue'
import MoodTagGroup from '@/components/mood/MoodTagGroup.vue'
import MoodTypeGroup from '@/components/mood/MoodTypeGroup.vue'
import { useMoodRecordStore } from '@/stores/moodRecordStore'

const store = useMoodRecordStore()
const moodTextareaRef = ref<HTMLTextAreaElement | null>(null)

const {
  moodOptions,
  tagOptions,
  selectedMoodTypes,
  moodContent,
  intensity,
  triggerInput,
  selectedTriggers,
  selectedTags,
  aiResult,
  aiLoading,
  aiHistory,
  historyLoading,
  autoRecommendations,
  hasDraft,
  isSubmitting,
  isSubmittingSuccess,
  selectedMoodMeta,
  filteredTriggerSuggestions,
  characterCount,
  formProgress,
  canAskAi,
  isAiTemporarilyDisabled,
  aiCooldownSeconds,
  aiServiceMessage,
  currentAiMoodMeta,
  draftSavedAtText,
} = storeToRefs(store)

const intensityTone = computed(() => {
  if (intensity.value <= 3) {
    return { emoji: '🌧️', label: '偏低能量', className: 'low' }
  }
  if (intensity.value <= 7) {
    return { emoji: '🌤️', label: '中段平衡', className: 'mid' }
  }
  return { emoji: '✨', label: '高能量', className: 'high' }
})

const canSubmit = computed(() => !isSubmitting.value)

const focusTextarea = () => {
  moodTextareaRef.value?.focus()
  moodTextareaRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

const handleGenerateAdvice = async () => {
  try {
    const isDisabled = Boolean(isAiTemporarilyDisabled?.value)
    const cooldownSeconds = aiCooldownSeconds?.value ?? 0
    const content = (moodContent?.value ?? '').trim()
    const canAsk = Boolean(canAskAi?.value)

    if (isDisabled) {
      ElMessage.warning(`建议服务恢复中，请 ${cooldownSeconds} 秒后再试`)
      return
    }

    if (!content) {
      const textareaEl =
        moodTextareaRef.value ||
        (document.querySelector('.writing-panel textarea') as HTMLTextAreaElement | null)
      textareaEl?.focus()
      textareaEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ElMessage.info('请先输入情绪描述，再获取建议')
      return
    }

    if (!canAsk) {
      focusTextarea()
      ElMessage.info('先补几句描述，系统才能给出更贴近的建议')
      return
    }

    const result = await store.requestAiAdvice()
    if (!result.ok && result.code === 'REQUEST_FAILED') {
      console.warn('建议请求失败', result.message)
    }
  } catch (error) {
    console.error('handleGenerateAdvice 执行异常', error)
    ElMessage.error('获取建议失败，请稍后重试')
  }
}

const appendRecommendation = (text: string) => {
  moodContent.value = [moodContent.value.trim(), text].filter(Boolean).join('\n')
}

const handleCopyAdvice = async () => {
  if (!store.copyableAdviceText) {
    return
  }

  try {
    await navigator.clipboard.writeText(store.copyableAdviceText)
    ElMessage.success('建议已复制')
  } catch (error) {
    console.error('复制建议失败', error)
    ElMessage.error('复制失败，请稍后重试')
  }
}

const handleApplyAllTriggers = () => {
  const appendedCount = store.applyAiSuggestionsToTriggers()
  if (appendedCount > 0) {
    ElMessage.success(`已补入 ${appendedCount} 个触发因素`)
    return
  }
  ElMessage.info('当前建议里没有可回填的触发因素')
}

const handleApplySingleTrigger = (index: number) => {
  const appendedCount = store.applyAiSuggestionsToTriggers(index)
  if (appendedCount > 0) {
    ElMessage.success('这条建议已回填到触发因素')
    return
  }
  ElMessage.info('这条建议暂时没有可提取的触发因素')
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
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(129, 140, 248, 0.2), transparent 28%),
    radial-gradient(circle at right 20%, rgba(196, 181, 253, 0.22), transparent 24%),
    linear-gradient(180deg, #f6f7ff 0%, #f4f5fb 100%);
}

.page-shell {
  width: min(1200px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 1.2rem;
}

.hero-panel,
.panel {
  border-radius: 22px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(99, 102, 241, 0.08);
}

.hero-panel {
  padding: 1.6rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: 1.5fr 1fr;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: #7c7fb7;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #1f2347;
}

h1 {
  font-size: clamp(1.9rem, 3vw, 2.6rem);
  line-height: 1.2;
}

h2 {
  font-size: 1.18rem;
}

.hero-copy {
  margin: 0.8rem 0 0;
  max-width: 46rem;
  color: #586080;
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
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.09), rgba(255, 255, 255, 0.88));
}

.hero-metrics strong {
  font-size: 1.5rem;
  color: #6366f1;
}

.hero-metrics span {
  color: #6d7295;
  font-size: 0.9rem;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.95fr);
  gap: 1.2rem;
  align-items: start;
}

.editor-column,
.ai-column {
  display: grid;
  gap: 1rem;
}

.ai-column {
  position: sticky;
  top: 20px;
}

.panel {
  padding: 1.25rem;
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
  border-radius: 16px;
  display: grid;
  justify-items: center;
  background: rgba(99, 102, 241, 0.08);
  color: #4d5378;
}

.intensity-badge.low {
  background: rgba(148, 163, 184, 0.16);
}

.intensity-badge.mid {
  background: rgba(99, 102, 241, 0.08);
}

.intensity-badge.high {
  background: rgba(129, 140, 248, 0.14);
}

.intensity-badge strong {
  font-size: 1.35rem;
}

.intensity-badge small,
.scale-labels,
.count-chip,
.ai-entry-row p,
.draft-banner small {
  color: #71789a;
}

.intensity-scale {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 0.45rem;
}

.scale-dot {
  min-height: 44px;
  border: none;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.08);
  color: #66708f;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.scale-dot.active {
  background: rgba(99, 102, 241, 0.18);
  color: #4850d8;
}

.scale-dot.current {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.22);
}

.intensity-slider {
  width: 100%;
  accent-color: #6366f1;
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.92rem;
}

textarea,
.trigger-input {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(248, 249, 255, 0.95);
  color: #2d345c;
  padding: 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

textarea {
  resize: vertical;
  min-height: 156px;
  line-height: 1.75;
}

textarea:focus,
.trigger-input:focus {
  border-color: rgba(99, 102, 241, 0.38);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
  background: #fff;
}

.count-chip {
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
  font-size: 0.86rem;
}

.inline-draft-tip {
  margin-bottom: 0.9rem;
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  background: rgba(99, 102, 241, 0.06);
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
  color: #4048b7;
  font-size: 0.92rem;
}

.tip-text small {
  color: #626b90;
}

.tip-actions {
  display: flex;
  gap: 0.55rem;
}

.tip-btn {
  border: none;
  border-radius: 10px;
  padding: 0.52rem 0.78rem;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #818cf8);
}

.tip-btn.ghost {
  color: #4b537b;
  background: rgba(99, 102, 241, 0.12);
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
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.inline-ai-btn,
.submit-action {
  padding: 0.9rem 1.15rem;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  box-shadow: 0 16px 26px rgba(99, 102, 241, 0.18);
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
  color: #6366f1;
  font-weight: 700;
  font-size: 0.88rem;
}

.auto-pill,
.suggestion-chip,
.selected-trigger,
.ghost-action,
.add-trigger-btn {
  padding: 0.74rem 0.95rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
  color: #53597f;
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
  background: rgba(99, 102, 241, 0.14);
  color: #454db8;
  font-weight: 700;
}

.selected-trigger span {
  margin-left: 0.35rem;
}

.draft-banner {
  display: none;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.08);
}

.draft-banner.visible {
  display: grid;
  gap: 0.2rem;
}

.ghost-action {
  background: rgba(99, 102, 241, 0.08);
}

.submit-action.success {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
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

@media (max-width: 1024px) {
  .content-grid,
  .hero-panel {
    grid-template-columns: 1fr;
  }

  .ai-column {
    position: static;
  }
}

@media (max-width: 768px) {
  .mood-record-page {
    padding: 16px;
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
