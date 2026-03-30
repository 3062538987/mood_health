import { debounce } from '@/utils/debounce'

export interface MoodAnalysisRequest {
  content: string
  mood_level: number
}

export interface MoodAnalysisResponse {
  analysis: string
  suggestions: string[]
  mood_score?: number
  risk_level?: string
  mood: string
}

const DEFAULT_FALLBACK_RESPONSE: MoodAnalysisResponse = {
  mood: '未知',
  analysis: '暂时无法分析您的情绪，请稍后重试',
  suggestions: ['请确保情绪描述内容清晰', '稍后再次尝试分析', '如问题持续，请联系客服'],
}

const getLocalFallbackMood = (content: string): MoodAnalysisResponse => {
  const happyKeywords = ['开心', '快乐', '高兴', '兴奋', '喜悦']
  const anxiousKeywords = ['焦虑', '紧张', '担心', '害怕', '恐惧']
  const depressedKeywords = ['抑郁', '难过', '伤心', '悲伤', '绝望']
  const angryKeywords = ['愤怒', '生气', '恼火', '烦躁']
  const tiredKeywords = ['疲惫', '累', '疲劳', '困']
  const excitedKeywords = ['兴奋', '激动', '期待']

  let mood = '平静'
  let maxScore = 0

  const keywords = [
    { mood: '开心', words: happyKeywords },
    { mood: '焦虑', words: anxiousKeywords },
    { mood: '抑郁', words: depressedKeywords },
    { mood: '愤怒', words: angryKeywords },
    { mood: '疲惫', words: tiredKeywords },
    { mood: '兴奋', words: excitedKeywords },
  ]

  keywords.forEach(({ mood: moodName, words }) => {
    const score = words.filter((keyword) => content.includes(keyword)).length
    if (score > maxScore) {
      maxScore = score
      mood = moodName
    }
  })

  const suggestions = {
    开心: ['保持积极的心态', '与朋友分享你的快乐', '记录下美好的时刻'],
    焦虑: ['尝试深呼吸放松', '制定合理的计划', '适当运动缓解压力'],
    抑郁: ['多与朋友交流', '适当户外活动', '必要时寻求专业帮助'],
    平静: ['保持当前的良好状态', '享受宁静的时光', '继续积极生活'],
    愤怒: ['冷静下来深呼吸', '找到合适的发泄方式', '分析愤怒的原因'],
    疲惫: ['保证充足睡眠', '适当休息放松', '注意劳逸结合'],
    兴奋: ['保持热情', '合理规划时间', '注意休息避免过度'],
    未知: ['请详细描述您的情绪', '稍后再次尝试', '如问题持续请联系客服'],
  }

  return {
    mood,
    analysis: `根据您的描述，您当前的情绪状态为${mood}。`,
    suggestions: suggestions[mood as keyof typeof suggestions] || suggestions.未知,
  }
}

export const analyzeMood = async (data: MoodAnalysisRequest): Promise<MoodAnalysisResponse> => {
  if (!data.content || !data.content.trim()) {
    throw new Error('情绪描述不能为空')
  }

  if (!data.mood_level || data.mood_level < 1 || data.mood_level > 10) {
    throw new Error('情绪强度必须在1-10之间')
  }

  try {
    return getLocalFallbackMood(data.content.trim())
  } catch {
    return DEFAULT_FALLBACK_RESPONSE
  }
}

export const debouncedAnalyzeMood = debounce<typeof analyzeMood>(analyzeMood, 500)

export const analyzeMoodWithRetry = async (
  data: MoodAnalysisRequest,
  maxRetries = 2
): Promise<MoodAnalysisResponse> => {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await analyzeMood(data)
    } catch (error: any) {
      lastError = error

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`分析失败，${delay}ms后重试 (${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  console.error('所有重试均失败，使用本地fallback方案')
  return getLocalFallbackMood(data.content)
}
