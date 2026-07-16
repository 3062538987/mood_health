/**
 * 计分引擎
 * 从 assessment_versions 的 JSON 规则中计算总分和风险分层
 */

export interface ScoringRule {
  type: 'sum' | 'average'
  min_score: number
  max_score: number
  reverse_items?: number[]
}

export interface RiskLevel {
  label: string
  range: [number, number]
  color: string
}

export interface RiskStratification {
  levels: RiskLevel[]
}

export interface SuggestionTemplate {
  levels: Record<string, string>
}

export interface ScoringResult {
  totalScore: number
  riskLevel: string
  riskColor: string
  suggestion: string
}

/**
 * 计算测评总分
 */
export const calculateScore = (
  answers: Array<{ itemId: number; score: number }>,
  rule: ScoringRule
): number => {
  let total = 0
  const reverseSet = new Set(rule.reverse_items ?? [])

  for (const answer of answers) {
    const score = reverseSet.has(answer.itemId)
      ? rule.max_score - answer.score
      : answer.score
    total += score
  }

  return total
}

/**
 * 根据总分查找风险分层
 */
export const findRiskLevel = (
  totalScore: number,
  stratification: RiskStratification,
  suggestion: SuggestionTemplate
): ScoringResult => {
  for (const level of stratification.levels) {
    const [min, max] = level.range
    if (totalScore >= min && totalScore <= max) {
      return {
        totalScore,
        riskLevel: level.label,
        riskColor: level.color,
        suggestion: suggestion.levels[level.label] || '',
      }
    }
  }
  return {
    totalScore,
    riskLevel: '未知',
    riskColor: 'gray',
    suggestion: '',
  }
}

/**
 * 完整的计分流程：计算总分 + 风险分层 + 建议
 */
export const scoreAssessment = (
  answers: Array<{ itemId: number; score: number }>,
  rule: ScoringRule,
  stratification: RiskStratification,
  suggestion: SuggestionTemplate
): ScoringResult => {
  const totalScore = calculateScore(answers, rule)
  return findRiskLevel(totalScore, stratification, suggestion)
}