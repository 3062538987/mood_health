/**
 * 心理咨询服务
 * 提供心理咨询对话功能，包含安全提示词和风险关键词拦截
 */

import logger from '../logger';
import { CounselingRequest, CounselingResponse } from '../../models/aiModel';

/**
 * 风险关键词列表
 * 包含自杀、自残等危险内容的关键词
 */
const RISK_KEYWORDS = [
  // 自杀相关
  '自杀', '自尽', '轻生', '寻死', '结束生命', '想死', '活不下去', '不想活',
  '自杀方法', '如何自杀', '自杀方式', '自杀计划', '自杀准备',
  
  // 自残相关
  '自残', '自虐', '割腕', '伤害自己', '自我伤害', '虐待自己',
  
  // 暴力相关
  '杀人', '暴力', '伤害他人', '攻击', '报复', '打架',
  
  // 药物滥用
  '吸毒', '贩毒', '滥用药物', '毒品', '嗑药',
  
  // 其他危险行为
  '酒驾', '醉驾', '危险驾驶', '飙车', '赌博', '沉迷游戏',
  
  // 极端情绪
  '绝望', '崩溃', '失控', '疯狂', '暴怒', '极度痛苦',
];

/**
 * 安全提示词
 * 用于指导AI回复，确保安全边界
 */
const SAFETY_PROMPT = `
你是一个专业的心理咨询陪伴助手，请注意以下安全规则：

1. 禁止进行任何形式的诊断：
   - 不要说"你有抑郁症"、"你有焦虑症"等诊断性语句
   - 不要使用医学术语进行病情判断
   - 只提供情绪支持和心理疏导

2. 禁止提供医疗建议：
   - 不要推荐具体药物或治疗方法
   - 不要指导用药剂量或频率
   - 不要替代专业医疗人员的建议

3. 保持专业边界：
   - 始终保持中立和专业的态度
   - 不做价值判断，尊重用户的感受
   - 提供情感支持和积极引导

4. 风险情况处理：
   - 如发现用户有自杀、自残或其他危险倾向，表达关心并建议寻求专业帮助
   - 不深入讨论危险行为的细节
   - 引导用户关注积极的方面

5. 回复风格：
   - 语气温和、耐心、理解
   - 回复长度控制在2-4句
   - 避免使用复杂术语
   - 提供具体的情感支持和鼓励
`;

/**
 * 心理咨询服务类
 */
class CounselingService {
  /**
   * 检查风险关键词
   * @param content 待检查的内容
   * @returns 是否包含风险内容
   */
  private checkRiskContent(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return RISK_KEYWORDS.some(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    );
  }

  /**
   * 生成心理咨询回复
   * @param request 咨询请求
   * @returns 咨询响应
   */
  async generateResponse(request: CounselingRequest): Promise<CounselingResponse> {
    try {
      // 检查风险内容
      const hasRiskContent = this.checkRiskContent(request.message);

      // 构建完整的提示词
      const prompt = this.buildPrompt(request, hasRiskContent);

      // 这里应该调用AI模型生成回复
      // 由于是示例，返回模拟数据
      const response = await this.simulateAIResponse(prompt, hasRiskContent);

      return {
        response,
        mood: request.mood?.[0] || '平静',
        riskLevel: hasRiskContent ? 'medium' : 'low',
        suggestion: hasRiskContent 
          ? '如果你正在经历困难，建议寻求专业心理咨询师的帮助' 
          : undefined,
        hasRiskContent
      };
    } catch (error) {
      logger.error('Counseling service error:', error);
      return {
        response: '很抱歉，我暂时无法为你提供帮助，请稍后再试',
        mood: '平静',
        riskLevel: 'low'
      };
    }
  }

  /**
   * 构建提示词
   * @param request 咨询请求
   * @param hasRiskContent 是否包含风险内容
   * @returns 完整的提示词
   */
  private buildPrompt(request: CounselingRequest, hasRiskContent: boolean): string {
    let prompt = SAFETY_PROMPT;

    // 添加对话上下文
    if (request.context && request.context.length > 0) {
      prompt += '\n\n对话历史：';
      request.context.forEach((msg, index) => {
        prompt += `\n${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`;
      });
    }

    // 添加当前用户消息
    prompt += `\n\n用户当前消息：${request.message}`;

    // 添加风险提示
    if (hasRiskContent) {
      prompt += '\n\n注意：用户消息包含风险内容，请表达关心并建议寻求专业帮助，不要深入讨论危险行为细节。';
    }

    // 添加回复要求
    prompt += '\n\n请生成一个2-4句的回复，语气温和、理解，提供情感支持和积极引导。';

    return prompt;
  }

  /**
   * 模拟AI回复
   * @param prompt 提示词
   * @param hasRiskContent 是否包含风险内容
   * @returns 模拟的AI回复
   */
  private async simulateAIResponse(prompt: string, hasRiskContent: boolean): Promise<string> {
    // 模拟AI思考时间
    await new Promise(resolve => setTimeout(resolve, 500));

    if (hasRiskContent) {
      return '我很担心你现在的状态，这种感受一定很痛苦。请记住，你不是一个人在面对这些困难，寻求专业帮助是很勇敢的选择。';
    }

    // 根据用户消息内容生成不同的回复
    const lowerMessage = prompt.toLowerCase();
    
    if (lowerMessage.includes('难过') || lowerMessage.includes('伤心')) {
      return '我能理解你现在感到难过，这种情绪是很正常的。给自己一些时间和空间，允许自己感受这些情绪。';
    } else if (lowerMessage.includes('焦虑') || lowerMessage.includes('担心')) {
      return '焦虑是很常见的情绪，尝试深呼吸，把注意力集中在当下。一步一步来，你可以慢慢应对这些挑战。';
    } else if (lowerMessage.includes('压力') || lowerMessage.includes('累')) {
      return '感受到压力是很正常的，记得要照顾好自己。适当休息，做一些让自己放松的事情，慢慢来。';
    } else if (lowerMessage.includes('开心') || lowerMessage.includes('高兴')) {
      return '看到你心情好，我也很开心！享受这些美好时光，它们是生活中重要的能量来源。';
    } else {
      return '谢谢你分享你的感受，我在这里倾听你。无论你现在是什么心情，都是可以被理解和接纳的。';
    }
  }

  /**
   * 验证咨询请求
   * @param request 咨询请求
   * @returns 是否有效
   */
  validateRequest(request: CounselingRequest): boolean {
    if (!request.message || !request.message.trim()) {
      return false;
    }

    if (request.message.length > 1000) {
      return false;
    }

    if (request.context && request.context.length > 10) {
      return false;
    }

    return true;
  }
}

// 导出单例实例
const counselingService = new CounselingService();
export default counselingService;