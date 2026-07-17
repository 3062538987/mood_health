import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import { callChatCompletion } from '../utils/ai/aiClient'
import logger from '../utils/logger'

const SYSTEM_PROMPT = `你是一个专业的心理咨询陪伴助手，请注意以下安全规则：

1. 禁止进行任何形式的诊断：
   - 不要说"你有抑郁症"、"你有焦虑症"等诊断性语句
   - 不要使用医学术语进行病情判断
   - 只提供情绪支持和心理疏导

2. 禁止提供医疗建议：
   - 不要推荐具体药物或治疗方法
   - 不要指导用药剂量或频率
   - 不要替代专业医疗人员的建议

3. 保持专业边界：
   - 始终保持中立和专业的态度
   - 不做价值判断，尊重用户的感受
   - 提供情感支持和积极引导

4. 风险情况处理：
   - 如发现用户有自杀、自残或其他危险倾向，表达关心并建议寻求专业帮助
   - 不深入讨论危险行为的细节
   - 引导用户关注积极的方面

5. 回复风格：
   - 语气温和、耐心、理解
   - 回复长度控制在2-4句
   - 避免使用复杂术语
   - 提供具体的情感支持和鼓励`

const RISK_KEYWORDS = ['自杀', '自尽', '轻生', '寻死', '自残', '自虐', '割腕', '伤害自己', '不想活', '活不下去']

const checkRiskContent = (message: string): boolean => {
  return RISK_KEYWORDS.some((kw) => message.includes(kw))
}

export const counselingHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { message, context } = req.body

    if (!message || !message.trim()) {
      return res.status(400).json(apiFailure(400, '消息内容不能为空'))
    }

    if (message.length > 1000) {
      return res.status(400).json(apiFailure(400, '消息内容不能超过1000字'))
    }

    const hasRisk = checkRiskContent(message)

    // 构建对话消息
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    // 添加对话上下文
    if (context && Array.isArray(context)) {
      const recentContext = context.slice(-10)
      for (const msg of recentContext) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // 添加当前用户消息
    let userMessage = message
    if (hasRisk) {
      userMessage = message + '\n\n（注意：用户消息包含风险内容，请表达关心并建议寻求专业帮助，不要深入讨论危险行为细节。）'
    }
    messages.push({ role: 'user', content: userMessage })

    const reply = await callChatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 600,
    })

    res.json(apiSuccess({
      response: reply,
      riskLevel: hasRisk ? 'medium' : 'low',
      hasRiskContent: hasRisk,
      suggestion: hasRisk ? '如果你正在经历困难，建议寻求专业心理咨询师的帮助' : undefined,
    }, '回复成功'))
  } catch (error: any) {
    logger.error('心理咨询调用失败', { error: error?.message })
    res.status(500).json(apiFailure(500, error?.message || 'AI 服务暂时不可用'))
  }
}