/** 测评管理后台的 CSV 导出辅助（纯函数，便于单测）。 */

import type { AdminAssessmentListItem } from '@/api/adminAssessments'

export interface RiskLevelOption {
  value: string
  label: string
}

export const DEFAULT_RISK_LEVEL_OPTIONS: RiskLevelOption[] = [
  { value: 'normal', label: '正常' },
  { value: 'mild', label: '轻度' },
  { value: 'moderate', label: '中度' },
  { value: 'high', label: '重度' },
]

export const riskLevelLabel = (
  level: string,
  options: RiskLevelOption[] = DEFAULT_RISK_LEVEL_OPTIONS,
): string => {
  const found = options.find((opt) => opt.value === level)
  return found ? found.label : level || '未知'
}

// CSV 转义：含逗号/引号/换行时整体加引号并转义内部引号
export const csvCell = (value: string): string => {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export const buildAssessmentCsv = (
  list: AdminAssessmentListItem[],
  options: RiskLevelOption[] = DEFAULT_RISK_LEVEL_OPTIONS,
  reviewedIds: Set<number> = new Set(),
): string => {
  const header = ['ID', '用户', '测评量表', '原始分', '筛查等级', '状态', '提交时间', '已复核']
  const rows = list.map((item) =>
    [
      String(item.id),
      item.username || `用户#${item.userId}`,
      item.instrumentName,
      String(item.rawScore ?? ''),
      riskLevelLabel(item.screeningLevel, options),
      item.status || '',
      item.submittedAt ? new Date(item.submittedAt).toLocaleString('zh-CN') : '',
      reviewedIds.has(item.id) ? '是' : '否',
    ]
      .map(csvCell)
      .join(','),
  )
  return ['﻿' + header.join(','), ...rows].join('\r\n')
}

export const downloadCsv = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
