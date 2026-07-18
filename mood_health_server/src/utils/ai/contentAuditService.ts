/**
 * 内容审核服务
 * 提供AI增强的文本违规检测功能
 */

import { callChatCompletion } from './aiClient';
import logger from '../logger';
import { setCache, getCache } from '../cache';
import { ContentAuditRequest, ContentAuditResult, getAICacheKey } from '../../models/aiModel';
import aiConfig from '../../config/aiConfig';
import { filterContent } from '../contentFilter';

/**
 * 内容审核服务类
 */
export class ContentAuditService {
  // 审核缓存版本号，更新敏感词列表后需递增以失效旧缓存
  private static readonly AUDIT_CACHE_VERSION = 1

  /**
   * 审核内容
   * @param request 内容审核请求
   * @returns 内容审核结果
   */
  async auditContent(request: ContentAuditRequest): Promise<ContentAuditResult> {
    const startTime = Date.now();
    const cacheKey = request.userId ? getAICacheKey('content', request.userId, `${ContentAuditService.AUDIT_CACHE_VERSION}:${request.content}`) : null;

    // 尝试从缓存获取
    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<ContentAuditResult>(cacheKey);
      if (cached) {
        logger.info(`Content audit cache hit for user ${request.userId}`);
        return cached;
      }
    }

    try {
      // 先进行基础敏感词过滤
      const basicResult = this.basicContentFilter(request.content);
      if (!basicResult.isSafe) {
        // 基础过滤已检测到问题，直接返回结果
        const auditResult: ContentAuditResult = {
          ...basicResult,
          timestamp: new Date().toISOString()
        };

        // 缓存结果
        if (aiConfig.enableCache && cacheKey) {
          await setCache(cacheKey, auditResult, aiConfig.cacheTTL);
        }

        return auditResult;
      }

      // 调用AI接口进行深度审核
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        {
          role: 'system',
          content: `你是一位内容审核助手。请审核以下内容是否包含违规信息。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "isSafe": true/false,
  "detectedIssues": ["问题1", "问题2"],
  "severity": "low/medium/high",
  "suggestion": "审核建议"
}

审核规则：
1. 检查内容是否包含暴力、恐怖、色情、赌博、诈骗等违规信息
2. 检查是否包含人身攻击、歧视、诽谤等不当言论
3. severity: low=轻微问题, medium=需要关注, high=严重违规
4. 如果内容安全，isSafe 为 true，detectedIssues 为空数组`,
        },
        {
          role: 'user',
          content: `内容类型：${request.type || '文本'}\n内容：${request.content}`,
        },
      ];

      const rawResponse = await callChatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 500,
      });

      let parsed: any;
      try {
        const jsonStr = (rawResponse.match(/\{[\s\S]*\}/) || ['{}'])[0];
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = {
          isSafe: true,
          detectedIssues: [],
          severity: 'low',
          suggestion: '审核服务暂时不可用',
        };
      }

      const result: ContentAuditResult = {
        isSafe: parsed.isSafe ?? true,
        detectedIssues: parsed.detectedIssues || [],
        severity: parsed.severity || 'low',
        suggestion: parsed.suggestion || '',
      };

      // 添加时间戳
      const auditResult: ContentAuditResult = {
        ...result,
        timestamp: new Date().toISOString()
      };

      // 缓存结果
      if (aiConfig.enableCache && cacheKey) {
        await setCache(cacheKey, auditResult, aiConfig.cacheTTL);
      }

      const endTime = Date.now();
      logger.info(`Content audit completed in ${endTime - startTime}ms`);
      return auditResult;
    } catch (error) {
      logger.error('Content audit failed:', error);

      // AI审核失败时使用基础过滤作为兜底
      return this.getLocalContentAudit(request.content);
    }
  }

  /**
   * 基础内容过滤
   * @param content 待过滤的内容
   * @returns 过滤结果
   */
  private basicContentFilter(content: string): Omit<ContentAuditResult, 'timestamp'> {
    const detectedIssues: string[] = [];

    // 使用统一的敏感词过滤
    const filterResult = filterContent(content);
    if (!filterResult.isSafe) {
      detectedIssues.push(...filterResult.detectedWords.map((w) => `包含敏感词: ${w}`));
    }

    // 检查内容长度
    if (content.length > 5000) {
      detectedIssues.push('内容过长');
    }

    // 检查链接
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern);
    if (urls && urls.length > 5) {
      detectedIssues.push('包含过多链接');
    }

    if (detectedIssues.length === 0) {
      return {
        isSafe: true,
        detectedIssues: [],
        severity: 'low',
        suggestion: '内容安全，可以发布'
      };
    }

    let severity: 'low' | 'medium' | 'high' = 'medium';
    if (detectedIssues.length >= 3) {
      severity = 'high';
    }

    let suggestion = '内容存在问题，建议修改后重新提交';
    if (severity === 'high') {
      suggestion = '内容违规，无法发布';
    }

    return {
      isSafe: false,
      detectedIssues,
      severity,
      suggestion
    };
  }

  /**
   * 本地内容审核fallback方案
   * @param content 待审核的内容
   * @returns 审核结果
   */
  private getLocalContentAudit(content: string): ContentAuditResult {
    const result = this.basicContentFilter(content);

    return {
      ...result,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检查内容是否应该自动拒绝
   * @param content 待审核的内容
   * @returns 是否应该自动拒绝
   */
  async shouldAutoReject(content: string): Promise<boolean> {
    const result = await this.auditContent({ content, type: 'post' });
    return !result.isSafe && result.severity === 'high';
  }

  /**
   * 检查内容是否应该标记为需要人工审核
   * @param content 待审核的内容
   * @returns 是否应该标记为需要人工审核
   */
  async shouldMarkForReview(content: string): Promise<boolean> {
    const result = await this.auditContent({ content, type: 'post' });
    return !result.isSafe && result.severity !== 'high';
  }

  /**
   * 脱敏处理内容
   * @param content 原始内容
   * @returns 脱敏后的内容
   */
  sanitizeContent(content: string): string {
    // 脱敏处理：手机号、身份证、邮箱、链接
    return content
      .replace(/\b1[3-9]\d{9}\b/g, '***') // 隐藏手机号
      .replace(/\b\d{17}[\dXx]\b/g, '***') // 隐藏身份证号
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***') // 隐藏邮箱
      .replace(/https?:\/\/[^\s]+/g, '***'); // 隐藏链接
  }
}

// 导出单例实例
const contentAuditService = new ContentAuditService();
export default contentAuditService;
