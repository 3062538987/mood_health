/**
 * AI 量表解读服务
 * 使用 Prompt 模板对评估结果进行 AI 分析
 */

import { callWithTemplate, isAiAvailable } from '../utils/ai/aiCallService'
import logger from '../utils/logger'

interface InterpretationInput {
  scaleName: string
  scaleType: string
  totalScore: number
  maxScore: number
  itemScores: Array<{ label: string; score: number }>
  riskLevel: string
}

interface InterpretationResult {
  content: string
  generatedAt: string
}

/**
 * 生成 AI 量表解读
 * @param input 评估结果数据
 * @returns AI 解读结果
 */
export const generateInterpretation = async (input: InterpretationInput): Promise<InterpretationResult> => {
  if (!isAiAvailable()) {
    throw new Error('AI 服务未启用，请设置 AI_ENABLED=true 并配置 API Key')
  }

  // 选择模板名称
  const templateName = input.scaleType === 'gad-7'
    ? 'GAD-7 量表解读'
    : 'PHQ-9 量表解读'

  const itemScoresStr = input.itemScores
    .map((item, i) => `Q${i + 1}: ${item.label} = ${item.score}分`)
    .join('\n')

  const variables = {
    scaleName: input.scaleName,
    totalScore: String(input.totalScore),
    maxScore: String(input.maxScore),
    itemScores: itemScoresStr || '无详细数据',
    riskLevel: input.riskLevel,
  }

  logger.info(`Generating AI interpretation with template: ${templateName}`)

  const content = await callWithTemplate(templateName, variables, { temperature: 0.5 })

  return {
    content,
    generatedAt: new Date().toISOString(),
  }
}

export default { generateInterpretation }