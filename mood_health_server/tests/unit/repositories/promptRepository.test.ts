import { createPromptRepository } from '../../../src/repositories/promptRepository'

describe('promptRepository', () => {
  it('maps JSON variables that mysql2 already parsed as an object', async () => {
    const db = {
      query: jest.fn().mockResolvedValueOnce([
        [
          {
            id: 1,
            name: '测试 Prompt',
            category: 'counseling',
            system_prompt: 'system',
            user_prompt_template: 'user',
            variables: { username: '学生' },
            model: 'deepseek-chat',
            temperature: 0.7,
            max_tokens: 2048,
            is_active: 1,
            sort_order: 0,
            created_at: '2026-07-16 00:00:00',
            updated_at: '2026-07-16 00:00:00',
          },
        ],
      ]),
    }
    const repository = createPromptRepository(db as never)

    await expect(repository.findById(1)).resolves.toMatchObject({
      id: 1,
      variables: { username: '学生' },
    })
  })
})
