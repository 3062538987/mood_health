"""
通用 AI 对话路由 — 接收 Node.js 的 ChatCompletion 请求，转发到 DeepSeek API。
"""

import logging
from fastapi import APIRouter, HTTPException
from app.config import get_settings
from app.models.contracts import ChatRequest, ChatResponse
from app.providers.openai_compatible import OpenAICompatibleProvider

logger = logging.getLogger("mood_ai_service")
router = APIRouter()

@router.post("/api/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """通用 AI 对话端点 — 转发 messages 到 DeepSeek"""
    settings = get_settings()
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=500, detail="AI_API_KEY 未配置")
    
    try:
        provider = OpenAICompatibleProvider(settings)
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        content, model, usage = await provider.chat(
            messages=messages,
            model=request.model,
            temperature=request.temperature or 0.7,
            max_tokens=request.maxTokens or 2048,
        )
        return ChatResponse(content=content, model=model, usage=usage)
    except ValueError as e:
        logger.error("对话参数错误: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("对话失败: %s", e)
        raise HTTPException(status_code=502, detail=f"AI 调用失败: {str(e)}")