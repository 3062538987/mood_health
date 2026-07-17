/**
 * AI 安全服务测试
 */

import {
  detectHighRisk,
  validateOutput,
  getSafeFallback,
  sanitizeOutput,
  AI_ERROR_CODES,
  buildSafeResponse,
} from '../../../src/utils/ai/aiSafetyService'

describe('aiSafetyService', () => {
  describe('detectHighRisk', () => {
    it('检测到高风险关键词返回 true', () => {
      expect(detectHighRisk('我最近想自杀')).toBe(true)
      expect(detectHighRisk('我想伤害别人')).toBe(true)
      expect(detectHighRisk('每天都想结束生命')).toBe(true)
    })

    it('普通内容返回 false', () => {
      expect(detectHighRisk('今天心情不太好')).toBe(false)
      expect(detectHighRisk('工作压力有点大')).toBe(false)
    })

    it('空输入返回 false', () => {
      expect(detectHighRisk('')).toBe(false)
    })
  })

  describe('validateOutput', () => {
    it('完整四段式返回 true', () => {
      const output = {
        summary: '现状概括',
        possibleCauses: '可能原因',
        todayActions: ['行动1', '行动2'],
        whenToSeekHelp: '求助提示',
      }
      expect(validateOutput(output)).toBe(true)
    })

    it('缺少字段返回 false', () => {
      expect(validateOutput({ summary: 'test' })).toBe(false)
      expect(validateOutput({})).toBe(false)
    })

    it('todayActions 为空数组返回 false', () => {
      expect(validateOutput({
        summary: 'test',
        possibleCauses: 'test',
        todayActions: [],
        whenToSeekHelp: 'test',
      })).toBe(false)
    })
  })

  describe('getSafeFallback', () => {
    it('高风险返回固定兜底', () => {
      const result = getSafeFallback(true)
      expect(result.todayActions.some((a: string) => a.includes('心理援助热线'))).toBe(true)
    })

    it('非高风险返回普通兜底', () => {
      const result = getSafeFallback(false)
      expect(result.todayActions.some((a: string) => a.includes('深呼吸'))).toBe(true)
    })
  })

  describe('sanitizeOutput', () => {
    it('脱敏手机号', () => {
      const result = sanitizeOutput({ text: '联系我13800138000' })
      expect(result.text).toBe('联系我[手机号]')
    })

    it('脱敏身份证号', () => {
      const result = sanitizeOutput({ text: '身份证110101199001011234' })
      expect(result.text).toBe('身份证[身份证号]')
    })
  })

  describe('buildSafeResponse', () => {
    it('超时错误码返回 1503', () => {
      const result = buildSafeResponse(AI_ERROR_CODES.TIMEOUT, false)
      expect(result.code).toBe(1503)
      expect(result.data.isFallback).toBe(true)
    })

    it('空响应错误码返回 1504', () => {
      const result = buildSafeResponse(AI_ERROR_CODES.EMPTY_RESPONSE, false)
      expect(result.code).toBe(1504)
    })

    it('格式错误返回 1505', () => {
      const result = buildSafeResponse(AI_ERROR_CODES.FORMAT_ERROR, false)
      expect(result.code).toBe(1505)
    })
  })
})