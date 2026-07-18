export type AnalysisPeriod = '7d' | '1m' | '3m' | '6m' | '1y'

export type AnalysisStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'retryable_failed'
  | 'failed_final'
  | 'superseded'

export interface AnalysisPattern {
  title: string
  observation: string
  evidence: string[]
  caveat?: string
}

export interface AnalysisAction {
  title: string
  steps: string[]
  estimatedMinutes: number
}

export interface AiAnalysisResult {
  summary: string
  patterns: AnalysisPattern[]
  possibleFactors: string[]
  actions: AnalysisAction[]
  whenToSeekHelp: string
  warnings: string[]
  provider?: string
  model?: string
  promptVersion?: string
}

export interface AnalysisJob {
  id: string
  requestId: string
  period: AnalysisPeriod
  dataVersion: string
  status: AnalysisStatus
  createdAt: string
  completedAt?: string
  result?: AiAnalysisResult
  error?: string
  retryCount: number
  maxRetries: number
  usesJournalExcerpt: boolean
}

export interface AnalysisHistoryItem {
  id: string
  period: AnalysisPeriod
  dataVersion: string
  status: AnalysisStatus
  createdAt: string
  completedAt?: string
  summary?: string
  recordCount: number
  dateRange: string
  usesJournalExcerpt: boolean
  isStale: boolean
  isLatest: boolean
}

export interface AnalysisDataScope {
  recordCount: number
  dateRange: string
  period: AnalysisPeriod
  dataVersion: string
  hasEnoughData: boolean
  isSingleRecord: boolean
}