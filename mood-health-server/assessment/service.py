"""
心理测评服务模块

提供情绪分析、心理评估等核心业务逻辑
"""

import json
from typing import Any, Dict, List, Optional, Tuple

import requests

from common import settings, get_logger
from common.utils import common_extract_json_from_text, common_slice_text
from db import CacheManager, build_cache_key
from .models import AssessmentRequest, AssessmentResponse

logger = get_logger(__name__)


class AssessmentService:
    """
    心理测评服务类
    
    提供情绪分析、心理评估等核心功能
    """
    
    def __init__(self):
        """初始化服务"""
        self.cache = CacheManager(key_prefix="assessment:")
        self.ollama_url = settings.OLLAMA_URL
        self.model_name = settings.OLLAMA_MODEL
    
    def _build_prompt(self, content: str, mood_level: int) -> str:
        """
        构建情绪分析提示词
        
        Args:
            content: 情绪描述内容
            mood_level: 情绪强度等级
            
        Returns:
            str: 完整的提示词
        """
        return f"""你是一名专业的大学生心理健康咨询师，请根据以下信息为用户提供专业、温和、实用的情绪疏导建议：

情绪描述：{content}
情绪强度：{mood_level}/10

要求：
1. 首先对用户的情绪状态进行分析（50字以内）
2. 提供3-5条具体、可执行的建议
3. 建议简洁明了，适合大学生理解和执行
4. 语气亲切，避免专业术语堆砌
5. 每条建议控制在30字以内

请按以下JSON格式返回（不要包含其他文字）：
{{
  "analysis": "情绪分析内容",
  "suggestions": ["建议1", "建议2", "建议3"]
}}"""
    
    def _parse_ai_response(self, ai_response: str) -> Dict[str, Any]:
        """
        解析AI模型返回的响应
        
        Args:
            ai_response: AI返回的原始文本
            
        Returns:
            Dict: 解析后的结果
        """
        # 尝试提取JSON
        parsed = common_extract_json_from_text(ai_response)
        
        if parsed and isinstance(parsed, dict):
            # 验证必要字段
            analysis = parsed.get("analysis", "")
            suggestions = parsed.get("suggestions", [])
            
            # 确保analysis是字符串
            if not isinstance(analysis, str):
                analysis = ai_response[:200]
            
            # 确保suggestions是列表
            if not isinstance(suggestions, list):
                suggestions = common_slice_text(ai_response, 50)[:3]
            
            return {
                "analysis": analysis.strip(),
                "suggestions": [s.strip() for s in suggestions if isinstance(s, str) and s.strip()]
            }
        
        # 兜底处理：文本切片
        return {
            "analysis": ai_response[:200].strip(),
            "suggestions": common_slice_text(ai_response, 50)[:3]
        }
    
    def _call_ollama(self, prompt: str) -> str:
        """
        调用Ollama模型
        
        Args:
            prompt: 提示词
            
        Returns:
            str: AI响应文本
            
        Raises:
            requests.RequestException: 请求失败
        """
        response = requests.post(
            self.ollama_url,
            json={
                "model": self.model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一名专业的大学生心理健康咨询师，请为用户提供专业、温和、实用的情绪疏导建议。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": settings.OLLAMA_TEMPERATURE,
                    "top_p": settings.OLLAMA_TOP_P,
                    "max_tokens": settings.OLLAMA_MAX_TOKENS
                }
            },
            timeout=settings.OLLAMA_TIMEOUT
        )
        
        if response.status_code != 200:
            raise requests.RequestException(f"Ollama API错误: {response.text}")
        
        result = response.json()
        return result.get("message", {}).get("content", "").strip()
    
    def assessment_analyze_mood(
        self,
        content: str,
        mood_level: int,
        use_cache: bool = True
    ) -> AssessmentResponse:
        """
        情绪分析核心函数
        
        分析用户情绪状态并给出建议
        
        Args:
            content: 情绪描述内容
            mood_level: 情绪强度等级 (1-10)
            use_cache: 是否使用缓存
            
        Returns:
            AssessmentResponse: 分析结果
            
        Raises:
            requests.RequestException: 模型调用失败
            ValueError: 参数验证失败
        """
        # 参数验证
        if not content or not content.strip():
            raise ValueError("情绪描述不能为空")
        
        if not 1 <= mood_level <= 10:
            raise ValueError("情绪强度必须在1-10之间")
        
        # 构建缓存键
        cache_key = None
        if use_cache:
            cache_key = build_cache_key("mood_analysis", content, mood_level)
            cached = self.cache.get(cache_key)
            if cached:
                logger.info(f"命中缓存: {cache_key}")
                return AssessmentResponse(**cached)
        
        # 构建提示词
        prompt = self._build_prompt(content, mood_level)
        
        # 调用AI模型
        try:
            ai_response = self._call_ollama(prompt)
        except requests.ConnectionError:
            logger.error("无法连接到Ollama服务")
            raise requests.ConnectionError("无法连接到Ollama服务，请确保Ollama正在运行")
        except requests.Timeout:
            logger.error("Ollama服务请求超时")
            raise requests.Timeout("Ollama服务请求超时")
        
        # 解析响应
        parsed_result = self._parse_ai_response(ai_response)
        
        # 构建响应对象
        response = AssessmentResponse(
            analysis=parsed_result["analysis"],
            suggestions=parsed_result["suggestions"],
            mood_score=mood_level * 10,  # 转换为百分制
            risk_level=self._calculate_risk_level(mood_level)
        )
        
        # 写入缓存
        if use_cache and cache_key:
            self.cache.set(cache_key, response.model_dump(), ttl=3600)
            logger.info(f"结果已缓存: {cache_key}")
        
        return response
    
    def _calculate_risk_level(self, mood_level: int) -> str:
        """
        计算风险等级
        
        Args:
            mood_level: 情绪强度等级
            
        Returns:
            str: 风险等级 (low/medium/high)
        """
        if mood_level <= 3:
            return "low"
        elif mood_level <= 7:
            return "medium"
        else:
            return "high"
    
    def batch_analyze(
        self,
        requests: List[AssessmentRequest]
    ) -> List[AssessmentResponse]:
        """
        批量情绪分析
        
        Args:
            requests: 分析请求列表
            
        Returns:
            List[AssessmentResponse]: 分析结果列表
        """
        results = []
        for req in requests:
            try:
                result = self.assessment_analyze_mood(
                    content=req.content,
                    mood_level=req.mood_level
                )
                results.append(result)
            except Exception as e:
                logger.error(f"批量分析失败: {e}")
                # 返回错误占位
                results.append(AssessmentResponse(
                    analysis="分析失败，请稍后重试",
                    suggestions=["请检查网络连接", "稍后再次尝试"]
                ))
        return results
    
    def health_check(self) -> Dict[str, Any]:
        """
        服务健康检查
        
        Returns:
            Dict: 健康状态信息
        """
        status = {
            "service": "assessment",
            "status": "healthy",
            "model": self.model_name,
            "cache_enabled": settings.CACHE_ENABLED
        }
        
        # 检查Ollama连接
        try:
            response = requests.get(
                self.ollama_url.replace("/api/generate", "/api/tags"),
                timeout=5
            )
            if response.status_code == 200:
                models = response.json().get("models", [])
                has_model = any(
                    self.model_name in model.get("name", "")
                    for model in models
                )
                status["ollama_connected"] = True
                status["model_available"] = has_model
            else:
                status["ollama_connected"] = False
                status["model_available"] = False
        except Exception as e:
            logger.error(f"健康检查失败: {e}")
            status["ollama_connected"] = False
            status["model_available"] = False
            status["status"] = "degraded"
        
        return status


# 便捷函数：单例服务实例
_assessment_service: Optional[AssessmentService] = None


def get_assessment_service() -> AssessmentService:
    """
    获取测评服务实例（单例）
    
    Returns:
        AssessmentService: 测评服务实例
    """
    global _assessment_service
    if _assessment_service is None:
        _assessment_service = AssessmentService()
    return _assessment_service


def assessment_analyze_mood(
    content: str,
    mood_level: int,
    use_cache: bool = True
) -> AssessmentResponse:
    """
    情绪分析便捷函数
    
    Args:
        content: 情绪描述内容
        mood_level: 情绪强度等级
        use_cache: 是否使用缓存
        
    Returns:
        AssessmentResponse: 分析结果
    """
    service = get_assessment_service()
    return service.assessment_analyze_mood(content, mood_level, use_cache)


def calculate_score(answers: List[Dict[str, Any]], scoring_rules: Dict[str, Any]) -> int:
    """
    计算测评得分
    
    Args:
        answers: 答案列表
        scoring_rules: 计分规则
        
    Returns:
        int: 总得分
    """
    total_score = 0
    
    for answer in answers:
        question_id = answer.get("question_id")
        selected = answer.get("selected_options", [])
        
        # 根据规则计算单题得分
        if question_id in scoring_rules:
            rule = scoring_rules[question_id]
            if isinstance(rule, dict):
                # 选项分值映射
                for option in selected:
                    total_score += rule.get(option, 0)
            elif isinstance(rule, int):
                # 固定分值
                total_score += rule
    
    return total_score


def generate_report(
    score: int,
    max_score: int,
    result_categories: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    生成测评报告
    
    Args:
        score: 实际得分
        max_score: 满分
        result_categories: 结果分类标准
        
    Returns:
        Dict: 测评报告
    """
    # 计算百分比
    percentage = (score / max_score * 100) if max_score > 0 else 0
    
    # 确定结果类别
    category = None
    for cat in sorted(result_categories, key=lambda x: x.get("min_score", 0)):
        if score >= cat.get("min_score", 0) and score <= cat.get("max_score", 100):
            category = cat
            break
    
    if category is None:
        category = {
            "name": "未知",
            "description": "无法确定结果类别",
            "suggestions": ["请重新测评"]
        }
    
    return {
        "score": score,
        "max_score": max_score,
        "percentage": round(percentage, 2),
        "category": category.get("name"),
        "description": category.get("description"),
        "suggestions": category.get("suggestions", [])
    }
