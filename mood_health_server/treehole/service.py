"""
树洞温柔回复服务模块

提供树洞帖子的温柔回复生成功能
"""

import json
import random
from typing import Optional

import requests

from common import settings, get_logger
from .models import GentleReplyRequest, GentleReplyResponse, ContentAuditResponse

logger = get_logger(__name__)


class TreeHoleService:
    """
    树洞服务类
    
    提供温柔回复生成、内容审核等功能
    """
    
    # 兜底回复文案（当AI服务异常时使用）
    FALLBACK_REPLIES = [
        "你的感受很重要，无论遇到什么，都请记得照顾好自己。",
        "每个人都会有低落的时候，这很正常。给自己一些时间，慢慢来。",
        "谢谢你愿意分享你的心事。请记住，你并不孤单。",
        "生活中的困难都是暂时的，相信你一定能够度过这个阶段。",
        "你的努力和坚持都值得被看见。请对自己温柔一点。",
        "有时候，允许自己脆弱也是一种勇敢。抱抱你。",
        "无论今天过得怎样，明天都是新的开始。",
        "你的存在本身就是一种美好，请珍惜自己。"
    ]
    
    # 敏感词列表（简单示例，实际项目中应该使用更完善的敏感词库）
    SENSITIVE_WORDS = [
        "自杀", "自残", "跳楼", "杀人", "暴力", "血腥", "色情", "赌博",
        "毒品", "吸毒", "贩毒", "诈骗", "诈骗", "黑客", "攻击"
    ]
    
    def __init__(self):
        """初始化服务"""
        self.ollama_url = settings.OLLAMA_URL
        self.model_name = settings.OLLAMA_MODEL
    
    def _build_gentle_prompt(self, content: str) -> str:
        """
        构建温柔回复提示词
        
        Args:
            content: 用户的树洞内容
            
        Returns:
            str: 完整的提示词
        """
        return f"""你是一位温暖、善解人意的树洞倾听者。请根据用户的分享，给出一个温柔、治愈、不煽情、不制造焦虑的回复。

用户的分享：{content}

回复要求：
1. 语气要温和、亲切，像朋友一样对话
2. 避免过度煽情或制造焦虑
3. 回复长度控制在100-200字之间
4. 给予适当的安慰和鼓励，但不要过度承诺
5. 如果用户表达负面情绪，给予理解和接纳
6. 避免使用说教或评判的语气
7. 可以适当分享一些温和的视角，但不要强行灌鸡汤

请直接回复用户的分享，不要添加任何前缀或格式标记。"""
    
    def _audit_content(self, content: str) -> ContentAuditResponse:
        """
        审核内容是否包含敏感词
        
        Args:
            content: 需要审核的内容
            
        Returns:
            ContentAuditResponse: 审核结果
        """
        content_lower = content.lower()
        
        for word in self.SENSITIVE_WORDS:
            if word in content_lower:
                logger.warning(f"内容审核不通过，包含敏感词: {word}")
                return ContentAuditResponse(
                    is_valid=False,
                    reason=f"内容包含不当信息，请修改后重试"
                )
        
        return ContentAuditResponse(is_valid=True)
    
    def _call_ai(self, prompt: str) -> Optional[str]:
        """
        调用AI模型生成回复
        
        Args:
            prompt: 提示词
            
        Returns:
            Optional[str]: AI生成的回复，失败返回None
        """
        try:
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "max_tokens": 300
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                reply = result.get("response", "").strip()
                
                # 清理回复内容
                reply = self._clean_reply(reply)
                
                return reply
            else:
                logger.error(f"AI调用失败: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"AI调用异常: {str(e)}")
            return None
    
    def _clean_reply(self, reply: str) -> str:
        """
        清理AI回复内容
        
        Args:
            reply: 原始回复
            
        Returns:
            str: 清理后的回复
        """
        # 移除可能的引号
        reply = reply.strip('"\'')
        
        # 移除常见的前缀
        prefixes_to_remove = [
            "回复：", "回复:", "答：", "答:", 
            "AI回复：", "AI回复:", "助手回复：", "助手回复:",
            "树洞回复：", "树洞回复:", "温柔回复：", "温柔回复:"
        ]
        
        for prefix in prefixes_to_remove:
            if reply.startswith(prefix):
                reply = reply[len(prefix):].strip()
        
        return reply
    
    def _get_fallback_reply(self) -> str:
        """
        获取兜底回复
        
        Returns:
            str: 随机选择的兜底回复
        """
        return random.choice(self.FALLBACK_REPLIES)
    
    async def generate_gentle_reply(self, request: GentleReplyRequest) -> GentleReplyResponse:
        """
        生成温柔回复
        
        Args:
            request: 温柔回复请求
            
        Returns:
            GentleReplyResponse: 温柔回复响应
        """
        # 记录调用日志
        logger.info(f"树洞温柔回复请求 - 用户ID: {request.user_id}, 内容长度: {len(request.content)}")
        
        # 内容审核
        audit_result = self._audit_content(request.content)
        if not audit_result.is_valid:
            logger.warning(f"内容审核不通过 - 用户ID: {request.user_id}, 原因: {audit_result.reason}")
            return GentleReplyResponse(
                reply=audit_result.reason,
                is_fallback=True
            )
        
        # 构建提示词
        prompt = self._build_gentle_prompt(request.content)
        
        # 调用AI生成回复
        ai_reply = self._call_ai(prompt)
        
        if ai_reply:
            # 记录成功日志
            logger.info(f"树洞温柔回复生成成功 - 用户ID: {request.user_id}")
            return GentleReplyResponse(
                reply=ai_reply,
                is_fallback=False
            )
        else:
            # AI调用失败，使用兜底回复
            fallback_reply = self._get_fallback_reply()
            logger.warning(f"AI调用失败，使用兜底回复 - 用户ID: {request.user_id}")
            return GentleReplyResponse(
                reply=fallback_reply,
                is_fallback=True
            )
    
    async def generate_reply_with_retry(
        self, 
        request: GentleReplyRequest, 
        max_retries: int = 2
    ) -> GentleReplyResponse:
        """
        带重试机制的温柔回复生成
        
        Args:
            request: 温柔回复请求
            max_retries: 最大重试次数
            
        Returns:
            GentleReplyResponse: 温柔回复响应
        """
        for attempt in range(max_retries + 1):
            result = await self.generate_gentle_reply(request)
            
            if not result.is_fallback:
                return result
            
            if attempt < max_retries:
                logger.info(f"温柔回复生成失败，准备重试 ({attempt + 1}/{max_retries})")
        
        return result
