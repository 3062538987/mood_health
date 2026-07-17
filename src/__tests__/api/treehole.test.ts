import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

import request from '@/utils/request'
import {
  checkSensitiveContent,
  validateTreeHoleContent,
  generateGentleReply,
} from '@/api/treehole'

const requestMock = vi.mocked(request)

describe('树洞内容验证', () => {
  describe('敏感内容检测', () => {
    it('检测到暴力关键词', () => {
      expect(checkSensitiveContent('今天遇到了暴力事件')).toBe(true)
    })

    it('检测到色情关键词', () => {
      expect(checkSensitiveContent('含有色情内容')).toBe(true)
    })

    it('正常内容不触发敏感检测', () => {
      expect(checkSensitiveContent('今天心情不太好，想找人说说话')).toBe(false)
    })

    it('多关键词检测', () => {
      expect(checkSensitiveContent('赌博和诈骗都很危险')).toBe(true)
    })
  })

  describe('内容验证', () => {
    it('空字符串返回错误', () => {
      expect(validateTreeHoleContent('')).toBe('内容不能为空')
    })

    it('纯空格返回错误', () => {
      expect(validateTreeHoleContent('   ')).toBe('内容不能为空')
    })

    it('超过1000字返回错误', () => {
      const longContent = 'a'.repeat(1001)
      expect(validateTreeHoleContent(longContent)).toBe('内容长度不能超过1000字')
    })

    it('敏感内容返回错误', () => {
      expect(validateTreeHoleContent('涉及暴力的话题')).toBe('内容包含敏感信息，请修改后重试')
    })

    it('正常内容返回 null', () => {
      expect(validateTreeHoleContent('今天心情不太好')).toBeNull()
    })
  })
})

describe('树洞温柔回复生成', () => {
  it('成功生成温柔回复', async () => {
    requestMock.mockResolvedValueOnce({
      reply: '我听到了你的声音，这并不容易，但你已经很勇敢了...',
      is_fallback: false,
    })

    const result = await generateGentleReply('最近压力很大，不知道该怎么办')

    expect(result.reply).toBeDefined()
    expect(result.is_fallback).toBe(false)
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/ai/treehole/gentle-reply',
      method: 'post',
      data: { content: '最近压力很大，不知道该怎么办' },
    })
  })

  it('空内容抛出错误', async () => {
    await expect(generateGentleReply('')).rejects.toThrow('内容不能为空')
  })

  it('超过1000字抛出错误', async () => {
    const longContent = 'a'.repeat(1001)
    await expect(generateGentleReply(longContent)).rejects.toThrow('内容长度不能超过1000字')
  })

  it('API 失败时正确处理错误', async () => {
    requestMock.mockRejectedValueOnce(new Error('服务暂时不可用'))

    await expect(generateGentleReply('正常内容')).rejects.toThrow('服务暂时不可用')
  })
})