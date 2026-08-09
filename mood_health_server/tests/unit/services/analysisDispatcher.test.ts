import { resolveJournalExcerpt } from '../../../src/services/analysisDispatcher'

describe('resolveJournalExcerpt — 隐私保护（日记授权）', () => {
  it('未授权时把日记原文强制置空，绝不外发到 AI 服务', () => {
    expect(resolveJournalExcerpt('今天心情很差，因为考试……', false)).toBeNull()
  })

  it('授权时保留日记原文', () => {
    expect(resolveJournalExcerpt('今天心情很差', true)).toBe('今天心情很差')
  })

  it('授权但未提供日记时仍为 null', () => {
    expect(resolveJournalExcerpt(undefined, true)).toBeNull()
    expect(resolveJournalExcerpt(null, true)).toBeNull()
  })
})
