import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { callChatCompletion } from '../utils/ai/aiClient'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import logger from '../utils/logger'

const buildInsightPrompt = (period: string, data: Record<string, unknown>): string => {
  const periodLabel = { day: '今天', week: '本周', month: '本月', year: '今年' }[period] || '当前'

  return `你是一位温暖、专业的心理咨询师。请根据以下用户${periodLabel}的情绪数据，生成一段200字以内的人性化分析。

分析要求：
1. 用温暖、共情的语气描述用户的情绪概况
2. 指出1-2个值得关注的情绪规律或趋势
3. 给出1-2条具体的、可操作的改善建议
4. 不要使用序号，用自然段落表达
5. 如果数据为空或很少，温和地鼓励用户继续记录

情绪数据：
${JSON.stringify(data, null, 2)}

请直接输出分析内容，不要加任何前缀或后缀。`
}

export const generateInsight = async (req: AuthRequest, res: Response) => {
  try {
    const { period, insightData } = req.body as { period: string; insightData: Record<string, unknown> }

    if (!insightData || !period) {
      return res.status(400).json(apiFailure(400, '缺少情绪数据或时间范围'))
    }

    if (!['day', 'week', 'month', 'year'].includes(period)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    // 如果没有任何记录，直接返回鼓励文案
    if (insightData.summary && (insightData.summary as Record<string, unknown>).totalRecords === 0) {
      return res.json(apiSuccess({
        analysis: '你还没有开始记录情绪哦。每天花一分钟记录自己的心情，积累一段时间后，我就能帮你分析情绪变化规律啦。加油，从今天开始吧！',
      }))
    }

    const prompt = buildInsightPrompt(period, insightData)
    const response = await callChatCompletion([
      { role: 'system', content: '你是一位温暖的心理咨询师，擅长用共情的方式分析情绪数据并给出建议。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.8, maxTokens: 600 })

    return res.json(apiSuccess({ analysis: response }))
  } catch (error) {
    logger.error('AI 洞察生成失败:', error)
    return res.status(500).json(apiFailure(500, 'AI 分析暂时不可用，请稍后重试'))
  }
}