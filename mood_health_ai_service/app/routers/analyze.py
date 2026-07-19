"""
情绪分析 API 路由 — 接收 Node.js 调度器的分析请求，调用 DeepSeek API 生成分析结果。
"""

import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse
from app.providers.openai_compatible import OpenAICompatibleProvider

logger = logging.getLogger("mood_ai_service")

router = APIRouter()


@router.post("/api/analyze/mood", response_model=MoodAnalysisResponse)
async def analyze(request: MoodAnalysisRequest):
    """情绪分析端点 — 调用 DeepSeek API 生成结构化分析报告"""
    settings = get_settings()

    if not settings.AI_API_KEY:
        raise HTTPException(status_code=500, detail="AI_API_KEY 未配置")

    try:
        provider = OpenAICompatibleProvider(settings)
        return await provider.analyze(request)
    except ValueError as e:
        logger.error("分析参数错误: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("分析失败: %s", e)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")