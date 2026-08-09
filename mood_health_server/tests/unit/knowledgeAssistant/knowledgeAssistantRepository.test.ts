import { createKnowledgeAssistantRepository } from '../../../src/repositories/knowledgeAssistantRepository'

describe('knowledgeAssistantRepository', () => {
  it('writes a user and assistant pair in one transaction', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{}, []]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    }
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) }
    const repository = createKnowledgeAssistantRepository(pool as never)

    await repository.saveMessagePair(7, 's1', '睡眠', {
      answer: '规律作息',
      sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
      requestId: 'r1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      fallbackUsed: false,
    })

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1)
    expect(connection.query).toHaveBeenCalledTimes(2)
    expect(connection.commit).toHaveBeenCalledTimes(1)
    expect(connection.rollback).not.toHaveBeenCalled()
    expect(connection.release).toHaveBeenCalledTimes(1)
  })

  it('loads messages with both user and session constraints', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue([[], []]),
    }
    const repository = createKnowledgeAssistantRepository(pool as never)

    await repository.loadMessages(7, 's1')

    const [sql, params] = pool.query.mock.calls[0]
    expect(sql).toContain('user_id = ?')
    expect(sql).toContain('session_id = ?')
    expect(params).toEqual([7, 's1'])
  })
})
