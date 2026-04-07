import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { useDebounceFn } from '@vueuse/core'
import {
  analyzeMoodWithRetry,
  getMoodAdviceHistory,
  saveMoodAdvice,
  submitMoodRecord,
  type AnalyzeMoodResponse,
  type MoodAdviceHistoryItem,
} from '@/api/mood'

const DRAFT_KEY = 'mood-record-draft-v2'
const DRAFT_EXPIRE_HOURS = 24
const MAX_MOOD_TYPES = 3
const AI_FAILURE_THRESHOLD = 3
const AI_DISABLE_COOLDOWN_MS = 2 * 60 * 1000

export interface MoodTypeOption {
  id: string
  label: string
  emoji: string
  description: string
  color: string
  softColor: string
}

interface MoodDraft {
  selectedMoodTypes: string[]
  moodContent: string
  intensity: number
  selectedTags: string[]
  selectedTriggers: string[]
  savedAt: number
}

interface RecommendationRule {
  keywords: string[]
  suggestions: string[]
  relatedTriggers: string[]
}

type AiAdviceRequestResult =
  | { ok: true }
  | {
      ok: false
      code: 'EMPTY_INPUT' | 'LOADING' | 'COOLDOWN' | 'REQUEST_FAILED'
      message: string
    }

const moodOptions: MoodTypeOption[] = [
  {
    id: 'happy',
    label: '快乐',
    emoji: '😊',
    description: '有被照亮、被接住的感觉。',
    color: '#6366f1',
    softColor: 'rgba(99, 102, 241, 0.14)',
  },
  {
    id: 'delight',
    label: '愉悦',
    emoji: '🌤️',
    description: '轻松而平稳，内心是柔软的。',
    color: '#8b5cf6',
    softColor: 'rgba(139, 92, 246, 0.14)',
  },
  {
    id: 'angry',
    label: '愤怒',
    emoji: '😠',
    description: '边界被碰撞，想表达不舒服。',
    color: '#ef4444',
    softColor: 'rgba(239, 68, 68, 0.12)',
  },
  {
    id: 'anxious',
    label: '焦虑',
    emoji: '😰',
    description: '脑海停不下来，身体有些绷紧。',
    color: '#f59e0b',
    softColor: 'rgba(245, 158, 11, 0.12)',
  },
  {
    id: 'calm',
    label: '平静',
    emoji: '😌',
    description: '节奏刚刚好，呼吸也更稳定。',
    color: '#14b8a6',
    softColor: 'rgba(20, 184, 166, 0.12)',
  },
  {
    id: 'excited',
    label: '兴奋',
    emoji: '🤩',
    description: '很有能量，也许想立刻行动。',
    color: '#ec4899',
    softColor: 'rgba(236, 72, 153, 0.12)',
  },
  {
    id: 'tired',
    label: '疲惫',
    emoji: '😴',
    description: '电量偏低，需要被照顾一下。',
    color: '#64748b',
    softColor: 'rgba(100, 116, 139, 0.12)',
  },
  {
    id: 'grateful',
    label: '感恩',
    emoji: '🥰',
    description: '看见了温暖，也想把它留下来。',
    color: '#10b981',
    softColor: 'rgba(16, 185, 129, 0.12)',
  },
]

const tagOptions = [
  '需要陪伴',
  '想慢下来',
  '有压力',
  '需要休息',
  '想表达',
  '想运动',
  '人际关系',
  '学业压力',
  '工作安排',
  '睡眠不足',
  '有成就感',
  '想独处',
]

const triggerPresets = [
  '考试',
  '作业',
  '熬夜',
  '社交',
  '家庭',
  '工作',
  '天气',
  '约会',
  '运动',
  '睡眠',
  '通勤',
  '音乐',
  '朋友',
  '成绩',
  '面试',
]

const recommendationRules: RecommendationRule[] = [
  {
    keywords: ['考试', '成绩', '面试', 'ddl', '作业', '学业'],
    suggestions: [
      '把任务拆成 15 分钟的小块，先完成最轻的一步。',
      '在正式开始前先做 3 轮缓慢呼吸，让身体降一点速。',
    ],
    relatedTriggers: ['考试', '作业', '成绩'],
  },
  {
    keywords: ['熬夜', '睡不着', '失眠', '困', '疲惫', '没精神'],
    suggestions: [
      '今晚尽量提前 30 分钟结束输入型任务，让大脑先安静下来。',
      '先补水、拉伸，再决定是否继续坚持，别把疲惫误判成无力。',
    ],
    relatedTriggers: ['熬夜', '睡眠'],
  },
  {
    keywords: ['朋友', '关系', '社交', '误会', '家庭', '吵架'],
    suggestions: [
      '先把感受写出来，再区分哪些是事实、哪些是脑补。',
      '如果要沟通，先说自己的感受，不急着给对方下结论。',
    ],
    relatedTriggers: ['朋友', '社交', '家庭'],
  },
  {
    keywords: ['开心', '顺利', '完成', '表扬', '进展', '成就'],
    suggestions: [
      '把今天做对的一件小事记下来，给自己留一个积极锚点。',
      '趁状态不错，安排一个轻量奖励，让好心情更稳定地停留。',
    ],
    relatedTriggers: ['有成就感', '工作', '朋友'],
  },
]

const moodPresentationMap: Record<string, { emoji: string; color: string }> = {
  快乐: { emoji: '😊', color: '#6366f1' },
  开心: { emoji: '😊', color: '#6366f1' },
  愉悦: { emoji: '🌤️', color: '#8b5cf6' },
  焦虑: { emoji: '😰', color: '#f59e0b' },
  平静: { emoji: '😌', color: '#14b8a6' },
  愤怒: { emoji: '😠', color: '#ef4444' },
  疲惫: { emoji: '😴', color: '#64748b' },
  兴奋: { emoji: '🤩', color: '#ec4899' },
  感恩: { emoji: '🥰', color: '#10b981' },
  抑郁: { emoji: '😢', color: '#64748b' },
  紧张: { emoji: '😟', color: '#f59e0b' },
  未知: { emoji: '🌙', color: '#94a3b8' },
}

const normalizeRatios = (count: number) => {
  if (count === 0) {
    return [] as number[]
  }

  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, index) => (index < remainder ? base + 1 : base))
}

const formatSavedAt = (savedAt?: number) => {
  if (!savedAt) {
    return '刚刚'
  }

  const diffMinutes = Math.max(1, Math.floor((Date.now() - savedAt) / 60000))
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} 小时前`
  }

  return new Date(savedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const useMoodRecordStore = defineStore('mood-record', () => {
  const selectedMoodTypes = ref<string[]>([])
  const moodRatios = ref<number[]>([])
  const moodContent = ref('')
  const intensity = ref(6)
  const triggerInput = ref('')
  const selectedTriggers = ref<string[]>([])
  const selectedTags = ref<string[]>([])
  const aiResult = ref<AnalyzeMoodResponse | null>(null)
  const aiLoading = ref(false)
  const aiHistory = ref<MoodAdviceHistoryItem[]>([])
  const historyLoading = ref(false)
  const autoRecommendations = ref<string[]>([])
  const hasDraft = ref(false)
  const lastDraftSavedAt = ref<number | null>(null)
  const initialized = ref(false)
  const isSubmitting = ref(false)
  const isSubmittingSuccess = ref(false)
  const aiFailureCount = ref(0)
  const aiDisabledUntil = ref<number | null>(null)
  const aiServiceMessage = ref('')

  const selectedMoodMeta = computed(() =>
    moodOptions.filter((item) => selectedMoodTypes.value.includes(item.id))
  )

  const filteredTriggerSuggestions = computed(() => {
    const keyword = triggerInput.value.trim().toLowerCase()
    const candidates = keyword
      ? triggerPresets.filter((item) => item.toLowerCase().includes(keyword))
      : triggerPresets

    return candidates.filter((item) => !selectedTriggers.value.includes(item)).slice(0, 6)
  })

  const characterCount = computed(() => moodContent.value.trim().length)

  const formProgress = computed(() => {
    const checks = [
      selectedMoodTypes.value.length > 0,
      characterCount.value > 0,
      selectedTriggers.value.length > 0,
      selectedTags.value.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  })

  const isAiTemporarilyDisabled = computed(
    () => !!aiDisabledUntil.value && Date.now() < aiDisabledUntil.value
  )

  const aiCooldownSeconds = computed(() => {
    if (!aiDisabledUntil.value) {
      return 0
    }
    return Math.max(0, Math.ceil((aiDisabledUntil.value - Date.now()) / 1000))
  })

  const canAskAi = computed(() => characterCount.value >= 6 && !isAiTemporarilyDisabled.value)

  const currentAiMoodMeta = computed(() => {
    const moodLabel = aiResult.value?.mood || '未知'
    const presentation = moodPresentationMap[moodLabel] || moodPresentationMap['未知']
    return {
      label: moodLabel,
      emoji: presentation.emoji,
      color: presentation.color,
    }
  })

  const copyableAdviceText = computed(() => {
    if (!aiResult.value) {
      return ''
    }

    return [
      `情绪分析：${aiResult.value.analysis}`,
      '',
      '建议：',
      ...aiResult.value.suggestions.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n')
  })

  const draftPreview = computed(
    () => moodContent.value.trim().slice(0, 48) || '你上次停在了一段尚未提交的情绪记录。'
  )
  const draftSavedAtText = computed(() => formatSavedAt(lastDraftSavedAt.value || undefined))

  const persistDraft = () => {
    const hasContent =
      selectedMoodTypes.value.length > 0 ||
      moodContent.value.trim().length > 0 ||
      selectedTags.value.length > 0 ||
      selectedTriggers.value.length > 0

    if (!hasContent) {
      localStorage.removeItem(DRAFT_KEY)
      hasDraft.value = false
      lastDraftSavedAt.value = null
      return
    }

    const draft: MoodDraft = {
      selectedMoodTypes: [...selectedMoodTypes.value],
      moodContent: moodContent.value,
      intensity: intensity.value,
      selectedTags: [...selectedTags.value],
      selectedTriggers: [...selectedTriggers.value],
      savedAt: Date.now(),
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    hasDraft.value = true
    lastDraftSavedAt.value = draft.savedAt
  }

  const loadDraft = () => {
    const draftRaw = localStorage.getItem(DRAFT_KEY)
    if (!draftRaw) {
      return null
    }

    try {
      const parsed = JSON.parse(draftRaw) as MoodDraft
      const ageHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60)
      if (ageHours > DRAFT_EXPIRE_HOURS) {
        localStorage.removeItem(DRAFT_KEY)
        return null
      }
      return parsed
    } catch (error) {
      console.error('解析情绪草稿失败', error)
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
  }

  const applyDraft = (draft: MoodDraft) => {
    selectedMoodTypes.value = [...draft.selectedMoodTypes]
    moodRatios.value = normalizeRatios(draft.selectedMoodTypes.length)
    moodContent.value = draft.moodContent || ''
    intensity.value = draft.intensity || 6
    selectedTags.value = [...draft.selectedTags]
    selectedTriggers.value = [...draft.selectedTriggers]
    lastDraftSavedAt.value = draft.savedAt
    hasDraft.value = true
    refreshAutoRecommendations()
  }

  const restoreDraft = () => {
    const draft = loadDraft()
    if (!draft) {
      hasDraft.value = false
      lastDraftSavedAt.value = null
      return
    }
    applyDraft(draft)
    ElMessage.success('草稿已恢复')
  }

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    hasDraft.value = false
    lastDraftSavedAt.value = null
  }

  const resetForm = () => {
    selectedMoodTypes.value = []
    moodRatios.value = []
    moodContent.value = ''
    intensity.value = 6
    triggerInput.value = ''
    selectedTriggers.value = []
    selectedTags.value = []
    aiResult.value = null
    autoRecommendations.value = []
    localStorage.removeItem(DRAFT_KEY)
    hasDraft.value = false
    lastDraftSavedAt.value = null
  }

  const toggleMoodType = (id: string) => {
    const index = selectedMoodTypes.value.indexOf(id)
    if (index >= 0) {
      selectedMoodTypes.value.splice(index, 1)
    } else {
      if (selectedMoodTypes.value.length >= MAX_MOOD_TYPES) {
        ElMessage.warning(`最多选择 ${MAX_MOOD_TYPES} 种情绪类型`)
        return
      }
      selectedMoodTypes.value.push(id)
    }
    moodRatios.value = normalizeRatios(selectedMoodTypes.value.length)
  }

  const toggleTag = (tag: string) => {
    const index = selectedTags.value.indexOf(tag)
    if (index >= 0) {
      selectedTags.value.splice(index, 1)
      return
    }
    selectedTags.value.push(tag)
  }

  const addTrigger = (trigger: string) => {
    const normalized = trigger.trim()
    if (!normalized || selectedTriggers.value.includes(normalized)) {
      triggerInput.value = ''
      return
    }
    selectedTriggers.value.push(normalized)
    triggerInput.value = ''
  }

  const removeTrigger = (trigger: string) => {
    selectedTriggers.value = selectedTriggers.value.filter((item) => item !== trigger)
  }

  const inferTriggerCandidates = (text: string) => {
    const source = text.toLowerCase()
    const matches = new Set<string>()

    triggerPresets.forEach((item) => {
      if (source.includes(item.toLowerCase())) {
        matches.add(item)
      }
    })

    selectedMoodMeta.value.forEach((item) => {
      if (source.includes(item.label.toLowerCase())) {
        matches.add(item.label)
      }
    })

    recommendationRules.forEach((rule) => {
      if (rule.keywords.some((keyword) => source.includes(keyword.toLowerCase()))) {
        rule.relatedTriggers.forEach((item) => matches.add(item))
      }
    })

    return Array.from(matches).slice(0, 5)
  }

  const refreshAutoRecommendations = () => {
    const source = [
      moodContent.value,
      selectedTriggers.value.join(' '),
      selectedMoodMeta.value.map((item) => item.label).join(' '),
      selectedTags.value.join(' '),
    ]
      .join(' ')
      .toLowerCase()

    if (!source.trim()) {
      autoRecommendations.value = []
      return
    }

    const matched = recommendationRules
      .filter((rule) => rule.keywords.some((keyword) => source.includes(keyword.toLowerCase())))
      .flatMap((rule) => rule.suggestions)

    if (matched.length > 0) {
      autoRecommendations.value = Array.from(new Set(matched)).slice(0, 4)
      return
    }

    if (intensity.value <= 3) {
      autoRecommendations.value = [
        '先把今天最消耗你的一件事写清楚，再决定要不要立刻处理它。',
        '给自己留 10 分钟无目标休息，先让身体放下来。',
      ]
      return
    }

    if (intensity.value >= 8) {
      autoRecommendations.value = [
        '把这份高能量落到一个具体小行动上，别只让情绪悬着。',
        '顺手记下今天让你开心的触发点，之后更容易复现它。',
      ]
      return
    }

    autoRecommendations.value = [
      '试着把情绪、触发事件和身体感受分开写，系统会更容易读懂你。',
      '如果不知道从哪里开始，可以先补 1 到 2 个触发因素。',
    ]
  }

  const fetchAdviceHistory = async () => {
    historyLoading.value = true
    try {
      const response = await requestWithRetry(
        () => getMoodAdviceHistory({ page: 1, pageSize: 6 }),
        1
      )
      aiHistory.value = response.list || []
      resetAiFailureState()
    } catch (error) {
      console.error('获取建议历史失败', error)
      markAiFailure('暂时无法加载建议历史，稍后会自动恢复。', true)
    } finally {
      historyLoading.value = false
    }
  }

  const shouldRetryError = (error: unknown) => {
    const requestError = error as {
      response?: { status?: number }
      code?: string
      message?: string
    }

    const status = requestError.response?.status || 0
    if (status === 429 || status >= 500) {
      return true
    }

    const message = (requestError.message || '').toLowerCase()
    if (
      requestError.code === 'ECONNABORTED' ||
      requestError.code === 'ETIMEDOUT' ||
      message.includes('timeout') ||
      message.includes('network')
    ) {
      return true
    }

    return false
  }

  const requestWithRetry = async <T>(
    handler: () => Promise<T>,
    retries: number,
    delay = 500
  ): Promise<T> => {
    try {
      return await handler()
    } catch (error) {
      if (retries > 0 && shouldRetryError(error)) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        return requestWithRetry(handler, retries - 1, delay * 2)
      }
      throw error
    }
  }

  const resetAiFailureState = () => {
    aiFailureCount.value = 0
    aiDisabledUntil.value = null
    aiServiceMessage.value = ''
  }

  const markAiFailure = (message: string, silent = false) => {
    aiFailureCount.value += 1
    aiServiceMessage.value = message

    if (aiFailureCount.value >= AI_FAILURE_THRESHOLD) {
      aiDisabledUntil.value = Date.now() + AI_DISABLE_COOLDOWN_MS
      aiServiceMessage.value = '建议服务连续异常，已临时暂停，请稍后重试。'
    }

    if (!silent) {
      ElMessage.error(message)
    }
  }

  const buildAiContext = () => {
    const moodContext = selectedMoodMeta.value.map((item) => item.label).join('、')
    const triggerContext = selectedTriggers.value.join('、')
    return [
      moodContent.value.trim(),
      moodContext ? `情绪类型：${moodContext}` : '',
      triggerContext ? `触发因素：${triggerContext}` : '',
      selectedTags.value.length > 0 ? `标签：${selectedTags.value.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const handleAiError = (error: unknown): string => {
    const requestError = error as {
      response?: {
        status?: number
        data?: { detail?: string; message?: string }
      }
      code?: string
      message?: string
    }

    if (requestError.response?.status === 429) {
      const message = '请求太频繁，请稍后再试'
      markAiFailure(message)
      return message
    }

    if ((requestError.response?.status || 0) >= 500) {
      const message = '建议服务暂时繁忙，请稍后重试'
      markAiFailure(message)
      return message
    }

    if (requestError.code === 'ECONNABORTED') {
      const message = '请求超时，请稍后重试'
      markAiFailure(message)
      return message
    }

    const message =
      requestError.response?.data?.detail ||
      requestError.response?.data?.message ||
      requestError.message ||
      '获取建议失败'
    markAiFailure(message)
    return message
  }

  const requestAiAdvice = async (): Promise<AiAdviceRequestResult> => {
    if (!moodContent.value.trim()) {
      const message = '先写一点今天的感受，建议模块才能更贴近你'
      ElMessage.warning(message)
      return { ok: false, code: 'EMPTY_INPUT', message }
    }
    if (aiLoading.value) {
      return { ok: false, code: 'LOADING', message: '建议正在生成中' }
    }

    if (isAiTemporarilyDisabled.value) {
      const message = '建议服务恢复中，请稍后再试'
      ElMessage.warning(message)
      return { ok: false, code: 'COOLDOWN', message }
    }

    aiLoading.value = true
    try {
      const response = await analyzeMoodWithRetry({
        content: buildAiContext(),
        mood_level: intensity.value,
      })
      aiResult.value = response
      await requestWithRetry(
        () =>
          saveMoodAdvice({
            analysis: response.analysis,
            suggestions: response.suggestions,
          }),
        1
      )
      resetAiFailureState()
      await fetchAdviceHistory()
      return { ok: true }
    } catch (error) {
      console.error('获取建议失败', error)
      const message = handleAiError(error)
      return { ok: false, code: 'REQUEST_FAILED', message }
    } finally {
      aiLoading.value = false
    }
  }

  const hydrateAdviceFromHistory = (item: MoodAdviceHistoryItem) => {
    aiResult.value = { analysis: item.analysis, suggestions: item.suggestions }
  }

  const applyAiSuggestionsToTriggers = (suggestionIndex?: number) => {
    if (!aiResult.value) {
      return 0
    }

    const source =
      suggestionIndex === undefined
        ? `${aiResult.value.analysis} ${aiResult.value.suggestions.join(' ')}`
        : aiResult.value.suggestions[suggestionIndex] || ''
    const candidates = inferTriggerCandidates(source)
    const originalCount = selectedTriggers.value.length

    candidates.forEach((item) => {
      if (!selectedTriggers.value.includes(item)) {
        selectedTriggers.value.push(item)
      }
    })

    return selectedTriggers.value.length - originalCount
  }

  const validateForm = () => {
    if (selectedMoodTypes.value.length === 0) {
      ElMessage.error('请至少选择一种情绪类型')
      return false
    }
    if (!moodContent.value.trim()) {
      ElMessage.error('请填写情绪描述')
      return false
    }
    if (moodContent.value.trim().length > 300) {
      ElMessage.error('情绪描述建议控制在 300 字以内')
      return false
    }
    return true
  }

  const submitRecord = async () => {
    if (!validateForm()) {
      return false
    }

    isSubmitting.value = true
    try {
await submitMoodRecord({
        moodType: [...selectedMoodTypes.value],
        moodRatio: [...moodRatios.value],
        event: moodContent.value.trim(),
        tags: Array.from(new Set([...selectedTags.value, ...selectedTriggers.value])),
        trigger: selectedTriggers.value.join(','),
        intensity: intensity.value,
      })

      ElMessage.success('这次心情已经好好存下来了')
      isSubmittingSuccess.value = true
      setTimeout(() => {
        isSubmittingSuccess.value = false
      }, 900)
      resetForm()
      return true
    } catch (error) {
      console.error('提交情绪记录失败', error)
      ElMessage.error('提交失败，请稍后再试')
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  const debouncedRefreshRecommendations = useDebounceFn(refreshAutoRecommendations, 240)

  watch(
    [selectedMoodTypes, moodContent, intensity, selectedTags, selectedTriggers],
    () => {
      if (!initialized.value) {
        return
      }
      persistDraft()
      debouncedRefreshRecommendations()
    },
    { deep: true }
  )

  const initializePage = async () => {
    const draft = loadDraft()
    if (draft) {
      lastDraftSavedAt.value = draft.savedAt
      hasDraft.value = true
    } else {
      hasDraft.value = false
    }

    refreshAutoRecommendations()
    initialized.value = true
    await fetchAdviceHistory()
  }

  return {
    moodOptions,
    tagOptions,
    triggerPresets,
    selectedMoodTypes,
    moodRatios,
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
    copyableAdviceText,
    draftPreview,
    draftSavedAtText,
    initializePage,
    restoreDraft,
    discardDraft,
    resetForm,
    toggleMoodType,
    toggleTag,
    addTrigger,
    removeTrigger,
    refreshAutoRecommendations,
    requestAiAdvice,
    hydrateAdviceFromHistory,
    applyAiSuggestionsToTriggers,
    submitRecord,
  }
})
