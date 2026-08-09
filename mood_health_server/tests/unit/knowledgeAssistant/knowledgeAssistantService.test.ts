const callRagAnswerMock = jest.fn()
const saveMessagePairMock = jest.fn()
const loadMessagesMock = jest.fn().mockResolvedValue([])
const sessionBelongsToUserMock = jest.fn().mockResolvedValue(true)

jest.mock('../../../src/services/fastApiClient', () => ({
  callRagAnswer: callRagAnswerMock,
}))

jest.mock('../../../src/repositories/knowledgeAssistantRepository', () => ({
  saveMessagePair: saveMessagePairMock,
  loadMessages: loadMessagesMock,
  sessionBelongsToUser: sessionBelongsToUserMock,
  listSessions: jest.fn(),
}))

import { answerKnowledgeQuestion } from '../../../src/services/knowledgeAssistantService'

describe('knowledgeAssistantService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not persist a fake answer when FastAPI fails', async () => {
    callRagAnswerMock.mockRejectedValue(
      Object.assign(new Error('not ready'), { response: { status: 503 } })
    )

    await expect(answerKnowledgeQuestion(7, '睡眠', 's1')).rejects.toThrow('not ready')

    expect(saveMessagePairMock).not.toHaveBeenCalled()
  })
})
