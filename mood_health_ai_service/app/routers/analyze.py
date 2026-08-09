"""
情绪分析 API 路由 — 接收 Node.js 调度器的分析请求，调用 DeepSeek API 生成分析结果。

内部接口：须通过 HMAC 签名鉴权（verify_internal_auth）+ 限流。
签名校验逻辑与 rag.py / assistant.py 保持一致，避免后端→AI 链路被打断。
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import ValidationError

from app.auth import verify_internal_auth
from app.config import get_settings
from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.ratelimit import rate_limit

logger = logging.getLogger("mood_ai_service")

router = APIRouter()


@router.post(
    "/api/analyze/mood",
    response_model=MoodAnalysisResponse,
    dependencies=[Depends(rate_limit())],
)
async def analyze(
    http_request: Request,
    x_signature: str | None = Header(default=None),
    x_timestamp: str | None = Header(default=None),
    x_nonce: str | None = Header(default=None),
) -> MoodAnalysisResponse:
    """情绪分析端点 — 调用 DeepSeek API 生成结构化分析报告"""
    body_bytes = await http_request.body()
    try:
        body = body_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=422, detail="请求体必须使用 UTF-8") from error

    # 1. 内部服务 HMAC 鉴权（含 nonce 防重放）
    authenticated, auth_error = await verify_internal_auth(
        body, x_signature, x_timestamp, x_nonce
    )
    if not authenticated:
        raise HTTPException(status_code=401, detail=auth_error)

    settings = get_settings()
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=500, detail="AI_API_KEY 未配置")

    # 2. 解析并校验请求体
    try:
        request = MoodAnalysisRequest.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors()) from error

    # 3. 调用 DeepSeek
    try:
        provider = OpenAICompatibleProvider(settings)
        return await provider.analyze(request)
    except ValueError as e:
        logger.error("分析参数错误: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("分析失败: %s", e)
        raise HTTPException(status_code=500, detail="分析失败") from e
