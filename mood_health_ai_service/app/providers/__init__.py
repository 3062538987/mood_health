"""异步模型调用接口，用于模块化 Provider 实现。"""

from typing import Protocol, runtime_checkable

from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse


@runtime_checkable
class AnalysisProvider(Protocol):
    """情绪分析 Provider 协议 — 所有实现必须遵守此接口"""

    async def analyze(self, request: MoodAnalysisRequest) -> MoodAnalysisResponse:
        """执行情绪分析，返回已验证的响应"""
        ...