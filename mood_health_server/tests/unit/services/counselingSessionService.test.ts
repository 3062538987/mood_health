import { getMysqlPool } from '../../../src/config/mysql'
import {
  buildDefaultSessionTitle,
  listSessions,
  loadSession,
  renameSession,
  saveMessagePair,
} from '../../../src/services/counselingSessionService'

jest.mock('../../../src/config/mysql', () => ({
  getMysqlPool: jest.fn(),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

const getMysqlPoolMock = jest.mocked(getMysqlPool)

describe('counselingSessionService history titles', () => {
  const query = jest.fn()

  beforeEach(() => {
    query.mockReset()
    getMysqlPoolMock.mockReturnValue({ query } as any)
  })

  it('normalizes and truncates a default title to 30 characters', () => {
    expect(buildDefaultSessionTitle('  最近\n总是   睡不好  ')).toBe('最近 总是 睡不好')
    expect(buildDefaultSessionTitle('a'.repeat(31))).toBe('a'.repeat(30))
    expect(buildDefaultSessionTitle('   ')).toBe('新对话')
  })

  it('uses the first user message when no saved title exists', async () => {
    query.mockResolvedValueOnce([[
      {
        session_id: 's1',
        custom_title: null,
        first_user_message: '  最近总是睡不好，白天也很累  ',
        created_at: new Date('2026-08-02T08:00:00Z'),
        last_message_at: new Date('2026-08-02T09:00:00Z'),
        message_count: 2,
      },
    ], []])

    await expect(listSessions(7)).resolves.toEqual([
      expect.objectContaining({
        sessionId: 's1',
        title: '最近总是睡不好，白天也很累',
        messageCount: 2,
      }),
    ])
  })

  it('loads messages only for the authenticated user and selected session', async () => {
    query.mockResolvedValueOnce([[], []])

    await loadSession(7, 's1')

    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ? AND session_id = ?'), [
      7,
      's1',
      20,
    ])
  })

  it('reloads assistant metadata and defaults a missing web-search status safely', async () => {
    query.mockResolvedValueOnce([[
      {
        role: 'assistant',
        content: 'A grounded answer',
        created_at: '2026-08-09T01:00:00.000Z',
        sources_json: JSON.stringify([
          { title: 'Legacy local source', reference: 'Legacy reference' },
          {
            sourceType: 'web',
            title: 'Current web source',
            reference: 'Web reference',
            url: 'https://example.org/support',
          },
        ]),
        web_search_status: null,
        grounding_used: 1,
        fallback_used: 0,
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      },
    ], []])

    await expect(loadSession(7, 's1')).resolves.toEqual([
      {
        role: 'assistant',
        content: 'A grounded answer',
        createdAt: '2026-08-09T01:00:00.000Z',
        sources: [
          { sourceType: 'local', title: 'Legacy local source', reference: 'Legacy reference' },
          {
            sourceType: 'web',
            title: 'Current web source',
            reference: 'Web reference',
            url: 'https://example.org/support',
          },
        ],
        webSearchStatus: 'not_requested',
        groundingUsed: true,
        fallbackUsed: false,
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      },
    ])
    expect(query.mock.calls[0][0]).toEqual(expect.stringContaining('web_search_status'))
  })

  it('drops unsafe source links and malformed source entries without failing history loading', async () => {
    query.mockResolvedValueOnce([[
      {
        role: 'assistant',
        content: 'Safe history',
        created_at: '2026-08-09T01:00:00.000Z',
        sources_json: [
          null,
          'not an object',
          { sourceType: 'web', title: 'HTTP', reference: 'unsafe', url: 'http://example.org' },
          { sourceType: 'web', title: 'Credentials', reference: 'unsafe', url: 'https://user:pass@example.org' },
          { sourceType: 'web', title: 'Malformed', reference: 'unsafe', url: 'https://%' },
          { sourceType: 'web', title: 'Too long', reference: 'unsafe', url: `https://example.org/${'a'.repeat(2048)}` },
          { sourceType: 'local', title: 'Local', reference: 'trusted', url: 'https://example.org/local' },
          { title: 'Legacy', reference: 'trusted', url: 'https://example.org/legacy' },
          { sourceType: 'other', title: 'Unknown', reference: 'ignored' },
          { sourceType: 'web', title: '', reference: 'missing title', url: 'https://example.org' },
        ],
        web_search_status: 'bogus',
        grounding_used: 0,
        fallback_used: 1,
        provider: null,
        model: null,
      },
    ], []])

    await expect(loadSession(7, 's1')).resolves.toEqual([
      expect.objectContaining({
        sources: [
          { sourceType: 'web', title: 'HTTP', reference: 'unsafe' },
          { sourceType: 'web', title: 'Credentials', reference: 'unsafe' },
          { sourceType: 'web', title: 'Malformed', reference: 'unsafe' },
          { sourceType: 'web', title: 'Too long', reference: 'unsafe' },
          { sourceType: 'local', title: 'Local', reference: 'trusted' },
          { sourceType: 'local', title: 'Legacy', reference: 'trusted' },
        ],
        webSearchStatus: 'not_requested',
        groundingUsed: false,
        fallbackUsed: true,
        provider: null,
        model: null,
      }),
    ])
  })

  it('prefers the saved title over the first user message', async () => {
    query.mockResolvedValueOnce([[
      {
        session_id: 's1',
        custom_title: '睡眠调整计划',
        first_user_message: '原始内容',
        created_at: new Date('2026-08-02T08:00:00Z'),
        last_message_at: new Date('2026-08-02T09:00:00Z'),
        message_count: 2,
      },
    ], []])

    await expect(listSessions(7)).resolves.toEqual([
      expect.objectContaining({ title: '睡眠调整计划' }),
    ])
  })

  it('returns false without writing when the session is not owned by the user', async () => {
    query.mockResolvedValueOnce([[], []])

    await expect(renameSession(7, 'other-session', '新标题')).resolves.toBe(false)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('upserts the title for an owned session', async () => {
    query
      .mockResolvedValueOnce([[{ exists: 1 }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])

    await expect(renameSession(7, 's1', '睡眠调整计划')).resolves.toBe(true)
    expect(query.mock.calls[1][1]).toEqual([7, 's1', '睡眠调整计划'])
  })
})

describe('counselingSessionService transactional message pairs', () => {
  const query = jest.fn()
  const beginTransaction = jest.fn()
  const commit = jest.fn()
  const rollback = jest.fn()
  const release = jest.fn()
  const getConnection = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    beginTransaction.mockResolvedValue(undefined)
    commit.mockResolvedValue(undefined)
    rollback.mockResolvedValue(undefined)
    release.mockReturnValue(undefined)
    query.mockResolvedValue([{ affectedRows: 1 }, []])
    getConnection.mockResolvedValue({ query, beginTransaction, commit, rollback, release })
    getMysqlPoolMock.mockReturnValue({ getConnection } as any)
  })

  it('commits the user and assistant messages in one transaction', async () => {
    await saveMessagePair(7, 's1', '用户问题', '助手回答', {
      sources: [{ sourceType: 'local', title: '睡眠', reference: '国家卫健委' }],
      requestId: 'r1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      groundingUsed: true,
      fallbackUsed: false,
      webSearchStatus: 'used',
    })

    expect(beginTransaction).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1][1]).toEqual([
      7,
      's1',
      '助手回答',
      JSON.stringify([{ sourceType: 'local', title: '睡眠', reference: '国家卫健委' }]),
      'r1',
      'deepseek',
      'deepseek-chat',
      true,
      false,
      'used',
    ])
    expect(commit).toHaveBeenCalledTimes(1)
    expect(rollback).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('rolls back and rethrows when the assistant message cannot be saved', async () => {
    query
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockRejectedValueOnce(new Error('write failed'))

    await expect(saveMessagePair(7, 's1', '用户问题', '助手回答', {
      sources: [],
      requestId: 'r2',
      provider: null,
      model: null,
      groundingUsed: false,
      fallbackUsed: true,
      webSearchStatus: 'not_requested',
    })).rejects.toThrow('write failed')

    expect(rollback).toHaveBeenCalledTimes(1)
    expect(commit).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
