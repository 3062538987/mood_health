import { callAssistantResponse } from '../../../src/services/fastApiClient'
import {
  loadSession,
  saveMessagePair,
} from '../../../src/services/counselingSessionService'
import { generateUnifiedAssistantResponse } from '../../../src/services/unifiedAssistantService'

jest.mock('../../../src/services/fastApiClient', () => ({
  callAssistantResponse: jest.fn(),
}))

jest.mock('../../../src/services/counselingSessionService', () => ({
  loadSession: jest.fn(),
  saveMessagePair: jest.fn(),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}))

const callAssistantResponseMock = jest.mocked(callAssistantResponse)
const loadSessionMock = jest.mocked(loadSession)
const saveMessagePairMock = jest.mocked(saveMessagePair)

describe('unifiedAssistantService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadSessionMock.mockResolvedValue([
      { role: 'user', content: '我最近睡不好' },
      { role: 'assistant', content: '我们可以一起看看作息' },
    ])
    saveMessagePairMock.mockResolvedValue(undefined)
  })

  it('returns grounded sources through the single counseling response contract', async () => {
    callAssistantResponseMock.mockResolvedValue({
      answer: '先固定每天的起床时间。',
      sources: [{
        sourceType: 'local',
        title: '睡眠卫生',
        reference: '国家卫健委',
        url: 'https://www.nhc.gov.cn/',
      }],
      groundingUsed: true,
      requestId: 'request-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      fallbackUsed: false,
      webSearchStatus: 'not_requested',
    })

    const result = await generateUnifiedAssistantResponse(7, 'session-1', '怎么改善睡眠？', false)

    expect(result).toEqual(expect.objectContaining({
      response: '先固定每天的起床时间。',
      sources: [{
        sourceType: 'local',
        title: '睡眠卫生',
        reference: '国家卫健委',
        url: 'https://www.nhc.gov.cn/',
      }],
      groundingUsed: true,
      requestId: 'request-1',
      fallbackUsed: false,
      webSearchStatus: 'not_requested',
    }))
    expect(callAssistantResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      query: '怎么改善睡眠？',
      riskDetected: false,
      history: [
        { role: 'user', content: '我最近睡不好' },
        { role: 'assistant', content: '我们可以一起看看作息' },
      ],
    }))
    expect(saveMessagePairMock).toHaveBeenCalledWith(
      7,
      'session-1',
      '怎么改善睡眠？',
      '先固定每天的起床时间。',
      expect.objectContaining({
        groundingUsed: true,
        requestId: 'request-1',
        webSearchStatus: 'not_requested',
      })
    )
  })

  it('marks risk before calling FastAPI and does not claim grounding', async () => {
    callAssistantResponseMock.mockResolvedValue({
      answer: '请立即联系身边可信任的人。',
      sources: [],
      groundingUsed: false,
      requestId: 'request-risk',
      provider: 'deepseek',
      model: 'deepseek-chat',
      fallbackUsed: false,
      webSearchStatus: 'not_requested',
    })

    const result = await generateUnifiedAssistantResponse(7, 'session-2', '我不想活了', false)

    expect(callAssistantResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      riskDetected: true,
    }))
    expect(result).toEqual(expect.objectContaining({
      hasRiskContent: true,
      riskLevel: 'medium',
      groundingUsed: false,
      sources: [],
    }))
  })

  it.each([
    { allowWebSearch: false, webSearchStatus: 'not_requested' as const },
    { allowWebSearch: true, webSearchStatus: 'not_needed' as const },
  ])(
    'forwards allowWebSearch=$allowWebSearch unchanged for each message',
    async ({ allowWebSearch, webSearchStatus }) => {
      callAssistantResponseMock.mockResolvedValue({
        answer: 'Record tonight\'s emotion changes first.',
        sources: [],
        groundingUsed: false,
        requestId: 'request-web-boundary',
        provider: 'deepseek',
        model: 'deepseek-chat',
        fallbackUsed: false,
        webSearchStatus,
      })

      await generateUnifiedAssistantResponse(
        7,
        'session-4',
        'I want to find resources.',
        allowWebSearch
      )

      expect(callAssistantResponseMock).toHaveBeenCalledWith(expect.objectContaining({
        allowWebSearch,
      }))
      expect(callAssistantResponseMock).toHaveBeenCalledTimes(1)
      expect(saveMessagePairMock).toHaveBeenCalledWith(
        7,
        'session-4',
        'I want to find resources.',
        'Record tonight\'s emotion changes first.',
        expect.objectContaining({ webSearchStatus })
      )
    }
  )

  it('uses and persists an explicit fallback when the provider is unavailable', async () => {
    callAssistantResponseMock.mockRejectedValue(new Error('provider unavailable'))

    const result = await generateUnifiedAssistantResponse(7, 'session-3', '我今天很难过', false)

    expect(result).toEqual(expect.objectContaining({
      fallbackUsed: true,
      provider: null,
      model: null,
      groundingUsed: false,
      sources: [],
      webSearchStatus: 'not_requested',
    }))
    expect(result.response).toContain('未生成真实 AI 回复')
    expect(saveMessagePairMock).toHaveBeenCalledWith(
      7,
      'session-3',
      '我今天很难过',
      result.response,
      expect.objectContaining({ fallbackUsed: true, groundingUsed: false })
    )
  })

  it('marks an authorized web search as failed when Node falls back', async () => {
    callAssistantResponseMock.mockRejectedValue(new Error('provider unavailable'))

    const result = await generateUnifiedAssistantResponse(
      7,
      'session-web-fallback',
      'Please check current support resources.',
      true
    )

    expect(result).toEqual(expect.objectContaining({
      fallbackUsed: true,
      sources: [],
      webSearchStatus: 'failed',
    }))
    expect(saveMessagePairMock).toHaveBeenCalledWith(
      7,
      'session-web-fallback',
      'Please check current support resources.',
      result.response,
      expect.objectContaining({ webSearchStatus: 'failed' })
    )
  })
})
