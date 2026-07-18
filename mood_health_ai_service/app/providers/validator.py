"""
严格输出验证 — 将 AI 原始 JSON 转换为 MoodAnalysisResponse。
拒绝缺失字段、额外字段、禁止字段。
"""

import logging
from typing import Any, Dict

from pydantic import ValidationError

from app.models.contracts import MoodAnalysisResponse

logger = logging.getLogger("mood_ai_service")


def validate_analysis_response(raw: Dict[str, Any], request_id: str) -> MoodAnalysisResponse:
    """
    验证 AI 原始输出，返回严格类型化的 MoodAnalysisResponse。

    检查项：
    1. 禁止字段 (mood_score, confidence, diagnosis)
    2. 必需字段存在性
    3. 额外字段拒绝
    4. 类型正确性
    """
    forbidden = ["mood_score", "confidence", "diagnosis"]
    for field in forbidden:
        if field in raw:
            logger.warning(
                "AI 输出包含禁止字段: requestId=%s, field=%s",
                request_id,
                field,
            )
            raise ValueError(
                f"AI 输出包含禁止字段 '{field}'，拒绝使用。"
            )

    try:
        result = MoodAnalysisResponse(**raw)
        return result
    except ValidationError as e:
        logger.error(
            "AI 输出验证失败: requestId=%s, errors=%s",
            request_id,
            e.errors(),
        )
        raise ValueError(
            f"AI 输出格式不符合合同: {e.errors()}"
        ) from e