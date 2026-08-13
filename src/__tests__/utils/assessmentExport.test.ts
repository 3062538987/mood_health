import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildAssessmentCsv,
  csvCell,
  downloadCsv,
  riskLevelLabel,
} from '@/utils/assessmentExport'
import type { AdminAssessmentListItem } from '@/api/adminAssessments'

const SAMPLE: AdminAssessmentListItem[] = [
  {
    id: 1,
    userId: 7,
    username: 'alice',
    instrumentName: 'PHQ-9',
    rawScore: 12,
    screeningLevel: 'moderate',
    status: 'submitted',
    startedAt: '2026-01-01T00:00:00Z',
    submittedAt: '2026-01-01T00:05:00Z',
  },
  {
    id: 2,
    userId: 9,
    username: 'bob',
    instrumentName: 'GAD-7',
    rawScore: 4,
    screeningLevel: 'mild',
    status: 'submitted',
    startedAt: '2026-01-02T00:00:00Z',
    submittedAt: '2026-01-02T00:05:00Z',
  },
]

describe('测评 CSV 导出工具', () => {
  let capturedCsv = ''

  beforeEach(() => {
    capturedCsv = ''
    const RealBlob = (globalThis as any).Blob
    vi.stubGlobal(
      'Blob',
      class extends RealBlob {
        constructor(parts: any, opts?: any) {
          capturedCsv = Array.isArray(parts) ? parts.join('') : String(parts)
          super(parts, opts)
        }
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('riskLevelLabel 把英文等级映射为中文', () => {
    expect(riskLevelLabel('moderate')).toBe('中度')
    expect(riskLevelLabel('mild')).toBe('轻度')
    expect(riskLevelLabel('unknown')).toBe('unknown')
    expect(riskLevelLabel('')).toBe('未知')
  })

  it('csvCell 对含逗号/引号的内容加引号转义', () => {
    expect(csvCell('普通')).toBe('普通')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('他说"好"')).toBe('"他说""好"""')
  })

  it('buildAssessmentCsv 生成含 BOM 表头与中文风险等级的 CSV', () => {
    const csv = buildAssessmentCsv(SAMPLE)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('ID,用户,测评量表,原始分,筛查等级,状态,提交时间,已复核')
    expect(csv).toContain('alice')
    expect(csv).toContain('PHQ-9')
    expect(csv).toContain('中度')
    expect(csv).toContain('轻度')
    expect(csv).toContain('否') // 默认未复核
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3) // 表头 + 2 行
  })

  it('buildAssessmentCsv 反映已复核集合', () => {
    const csv = buildAssessmentCsv(SAMPLE, undefined, new Set([1]))
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('是') // id=1 已复核
    expect(lines[2]).toContain('否') // id=2 未复核
  })

  it('downloadCsv 触发带文件名的 Blob 下载', () => {
    downloadCsv('测评管理_2026-08-10.csv', 'ID,用户\r\n1,alice')
    expect(capturedCsv).toBe('ID,用户\r\n1,alice')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })
})
