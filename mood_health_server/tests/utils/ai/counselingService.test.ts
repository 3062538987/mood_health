/**
 * 心理咨询控制器测试
 * 测试 counselingHandler 的请求验证和风险检测逻辑
 */

import { counselingHandler } from '../../../src/controllers/counselingController'
import { AuthRequest } from '../../../src/middleware/auth'
import { Response } from 'express'
import { callChatCompletion } from '../../../src/utils/ai/aiClient'

jest.mock('../../../src/utils/ai/aiClient', () => ({
  callChatCompletion: jest.fn(),
}))

const mockedCallChatCompletion = callChatCompletion as jest.MockedFunction<typeof callChatCompletion>

describe('心理咨询控制器测试', () => {
  let req: Partial<AuthRequest>
  let res: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jsonMock = jest.fn().mockReturnThis()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })
    res = { status: statusMock, json: jsonMock }
    mockedCallChatCompletion.mockResolvedValue('这是一个测试回复')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('应该拒绝空消息', async () => {
    req = { body: { message: '' } }
    await counselingHandler(req as AuthRequest, res as Response)
    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 400, message: '消息内容不能为空' })
    )
  })

  it('应该拒绝纯空格消息', async () => {
    req = { body: { message: '   ' } }
    await counselingHandler(req as AuthRequest, res as Response)
    expect(statusMock).toHaveBeenCalledWith(400)
  })

  it('应该拒绝过长的消息', async () => {
    req = { body: { message: 'a'.repeat(1001) } }
    await counselingHandler(req as AuthRequest, res as Response)
    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 400, message: '消息内容不能超过1000字' })
    )
  })

  it('应该成功生成心理咨询响应', async () => {
    mockedCallChatCompletion.mockResolvedValueOnce('我理解你的焦虑感受。让我们一起来分析一下...')
    req = { body: { message: '我最近感到很焦虑，不知道该怎么办' } }

    await counselingHandler(req as AuthRequest, res as Response)

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({
          response: '我理解你的焦虑感受。让我们一起来分析一下...',
          riskLevel: 'low',
          hasRiskContent: false,
        }),
      })
    )
  })

  it('应该检测到风险内容并设置相应的风险级别', async () => {
    mockedCallChatCompletion.mockResolvedValueOnce('如果你正在经历困难，建议寻求专业帮助。')
    req = { body: { message: '我想自杀，觉得活不下去了' } }

    await counselingHandler(req as AuthRequest, res as Response)

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({
          riskLevel: 'medium',
          hasRiskContent: true,
          suggestion: '如果你正在经历困难，建议寻求专业心理咨询师的帮助',
        }),
      })
    )
  })

  it('应该处理带上下文的请求', async () => {
    mockedCallChatCompletion.mockResolvedValueOnce('让我们继续聊聊你的压力来源...')
    req = {
      body: {
        message: '我还是觉得很焦虑',
        context: [
          { role: 'user', content: '我最近工作压力很大' },
          { role: 'assistant', content: '工作压力大确实会让人感到疲惫，你能具体说说是什么让你感到压力吗？' },
        ],
      },
    }

    await counselingHandler(req as AuthRequest, res as Response)

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        data: expect.objectContaining({
          response: '让我们继续聊聊你的压力来源...',
        }),
      })
    )
  })

  it('应该处理 AI 调用失败并返回 500', async () => {
    mockedCallChatCompletion.mockRejectedValueOnce(new Error('AI 服务不可用'))
    req = { body: { message: '我感到很焦虑' } }

    await counselingHandler(req as AuthRequest, res as Response)

    expect(statusMock).toHaveBeenCalledWith(500)
  })
})