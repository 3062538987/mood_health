import { ref, computed } from 'vue'
import { debounce } from '@/utils/debounce'
import request from '@/utils/request'
import type { MoodAIAnalysisResult, MoodTrendPrediction } from '@/types/ai'

/**
 * 情绪分析AI模块
 * 封装情绪文本解析、情绪趋势预测逻辑
 */
export function useMoodAIAnalysis() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const analysisResult = ref<MoodAIAnalysisResult | null>(null)
  const trendPrediction = ref<MoodTrendPrediction | null>(null)

  /**
   * 情绪文本解析
   * @param text 待分析的文本
   * @returns 情绪分析结果
   */
  const analyzeMood = async (text: string): Promise<MoodAIAnalysisResult> => {
    isLoading.value = true
    error.value = null

    try {
      // 数据脱敏处理
      const sanitizedText = sanitizeText(text)

      // 调用后端AI接口
      const response = await request<MoodAIAnalysisResult>({
        url: '/api/ai/analyze-mood',
        method: 'post',
        data: {
          text: sanitizedText,
        },
      })

      analysisResult.value = response
      return response
    } catch (err) {
      error.value = '情绪分析失败，请稍后重试'
      console.error('Mood analysis error:', err)
      // 本地fallback方案
      return getLocalMoodAnalysis(text)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 情绪趋势预测
   * @param historicalData 历史情绪数据
   * @param days 预测天数
   * @returns 情绪趋势预测结果
   */
  const predictMoodTrend = async (
    historicalData: Array<{ date: string; intensity: number }>,
    days: number = 7
  ): Promise<MoodTrendPrediction> => {
    isLoading.value = true
    error.value = null

    try {
      // 调用后端AI接口
      const response = await request<MoodTrendPrediction>({
        url: '/api/ai/predict-mood-trend',
        method: 'post',
        data: {
          historicalData,
          days,
        },
      })

      trendPrediction.value = response
      return response
    } catch (err) {
      error.value = '情绪趋势预测失败，请稍后重试'
      console.error('Mood trend prediction error:', err)
      // 本地fallback方案
      return getLocalMoodTrend(historicalData, days)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 防抖版本的情绪分析
   * @param text 待分析的文本
   * @returns 情绪分析结果
   */
  const debouncedAnalyzeMood = debounce((...args: unknown[]) => {
    const [text] = args
    return analyzeMood(text as string)
  }, 500)

  /**
   * 数据脱敏处理
   * @param text 原始文本
   * @returns 脱敏后的文本
   */
  const sanitizeText = (text: string): string => {
    // 简单的脱敏处理，实际项目中可以根据需要扩展
    return text
      .replace(/\d{11}/g, '***') // 隐藏手机号
      .replace(/\d{18}/g, '***') // 隐藏身份证号
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***') // 隐藏邮箱
  }

  /**
   * 本地情绪分析fallback方案
   * @param text 待分析的文本
   * @returns 情绪分析结果
   */
  const getLocalMoodAnalysis = (text: string): MoodAIAnalysisResult => {
    // 简单的关键词匹配逻辑
    const happyKeywords = ['开心', '快乐', '高兴', '兴奋', '喜悦']
    const anxiousKeywords = ['焦虑', '紧张', '担心', '害怕', '恐惧']
    const depressedKeywords = ['抑郁', '难过', '伤心', '悲伤', '绝望']

    let happyScore = 0
    let anxiousScore = 0
    let depressedScore = 0

    happyKeywords.forEach((keyword) => {
      if (text.includes(keyword)) happyScore += 1
    })

    anxiousKeywords.forEach((keyword) => {
      if (text.includes(keyword)) anxiousScore += 1
    })

    depressedKeywords.forEach((keyword) => {
      if (text.includes(keyword)) depressedScore += 1
    })

    const totalScore = happyScore + anxiousScore + depressedScore
    let mood = '平静'
    let confidence = 0.5

    if (totalScore > 0) {
      if (happyScore > anxiousScore && happyScore > depressedScore) {
        mood = '开心'
        confidence = happyScore / totalScore
      } else if (anxiousScore > happyScore && anxiousScore > depressedScore) {
        mood = '焦虑'
        confidence = anxiousScore / totalScore
      } else if (depressedScore > happyScore && depressedScore > anxiousScore) {
        mood = '抑郁'
        confidence = depressedScore / totalScore
      }
    }

    return {
      mood,
      confidence,
      emotions: [
        { tag: '开心', score: happyScore / (totalScore || 1) },
        { tag: '焦虑', score: anxiousScore / (totalScore || 1) },
        { tag: '抑郁', score: depressedScore / (totalScore || 1) },
        { tag: '平静', score: totalScore === 0 ? 1 : 0 },
      ],
      suggestion: getMoodSuggestion(mood),
    }
  }

  /**
   * 本地情绪趋势预测fallback方案
   * @param historicalData 历史情绪数据
   * @param days 预测天数
   * @returns 情绪趋势预测结果
   */
  const getLocalMoodTrend = (
    historicalData: Array<{ date: string; intensity: number }>,
    days: number
  ): MoodTrendPrediction => {
    if (historicalData.length === 0) {
      return {
        labels: Array.from({ length: days }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() + i + 1)
          return date.toISOString().split('T')[0]
        }),
        data: Array(days).fill(5),
        trend: '数据不足，无法预测',
      }
    }

    // 简单的线性预测
    const recentData = historicalData.slice(-7)
    const averageIntensity =
      recentData.reduce((sum, item) => sum + item.intensity, 0) / recentData.length

    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() + i + 1)
      return date.toISOString().split('T')[0]
    })

    const data = Array(days).fill(averageIntensity)
    const trend =
      averageIntensity > 6 ? '情绪趋于积极' : averageIntensity < 4 ? '情绪趋于消极' : '情绪趋于稳定'

    return {
      labels,
      data,
      trend,
    }
  }

  /**
   * 根据情绪类型获取建议
   * @param mood 情绪类型
   * @returns 建议文本
   */
  const getMoodSuggestion = (mood: string): string => {
    const suggestions = {
      开心: '保持积极的心态，继续享受美好的时光！',
      焦虑: '尝试深呼吸和冥想，缓解焦虑情绪。',
      抑郁: '建议多与朋友交流，适当运动，必要时寻求专业帮助。',
      平静: '保持当前的良好状态，继续享受平静的生活。',
    }

    return suggestions[mood as keyof typeof suggestions] || '保持良好的心态，积极面对生活。'
  }

  return {
    isLoading,
    error,
    analysisResult,
    trendPrediction,
    analyzeMood,
    predictMoodTrend,
    debouncedAnalyzeMood,
  }
}
