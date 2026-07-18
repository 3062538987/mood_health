"""
FastAPI 情绪分析合同 — 唯一接口定义。

Node 发送请求体，FastAPI 返回响应体。两端共用此合同。
额外字段拒绝 (extra='forbid')，禁止 mood_score/confidence/diagnosis。
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ---- 请求 ----

Period = Literal["7d", "1m", "3m", "6m", "1y"]


class MetricPoint(BaseModel):
    """单个情绪指标数据点"""
    date: str = Field(..., description="ISO 日期 YYYY-MM-DD")
    emotionName: str
    emotionCategory: Literal["positive", "negative", "neutral"]
    intensity: float = Field(..., ge=1, le=10)
    count: int = Field(..., ge=1)


class TrendPoint(BaseModel):
    """趋势数据点"""
    date: str = Field(..., description="ISO 日期 YYYY-MM-DD")
    avgIntensity: float = Field(..., ge=1, le=10)
    dominantEmotion: str
    recordCount: int = Field(..., ge=1)


class MoodAnalysisRequest(BaseModel):
    """情绪分析请求 — 仅接受以下字段"""
    model_config = {"extra": "forbid"}

    contractVersion: str = Field(default="1.0.0")
    requestId: str = Field(..., min_length=1, max_length=128)
    period: Period
    dataVersion: str = Field(..., min_length=1, max_length=256)
    locale: str = Field(default="zh-CN", max_length=10)

    # 聚合数据（由 Node 从 MySQL 计算）
    metrics: List[MetricPoint] = Field(default_factory=list)
    trend: List[TrendPoint] = Field(default_factory=list)
    triggers: List[str] = Field(default_factory=list, max_length=100)

    # 日记正文（本次可选授权）
    journalExcerpt: Optional[str] = Field(default=None, max_length=5000)
    journalConsent: bool = Field(default=False)


# ---- 响应 ----

class PatternItem(BaseModel):
    """情绪模式"""
    model_config = {"extra": "forbid"}

    title: str
    observation: str
    evidence: str
    caveat: Optional[str] = None


class ActionItem(BaseModel):
    """行动建议"""
    model_config = {"extra": "forbid"}

    title: str
    steps: List[str] = Field(default_factory=list)
    estimatedMinutes: Optional[int] = Field(default=None, ge=1)


class MoodAnalysisResponse(BaseModel):
    """情绪分析响应 — 固定结构，禁止额外字段"""
    model_config = {"extra": "forbid"}

    summary: str
    patterns: List[PatternItem] = Field(default_factory=list)
    possibleFactors: List[str] = Field(default_factory=list)
    actions: List[ActionItem] = Field(default_factory=list)
    whenToSeekHelp: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)

    # 来源溯源
    provider: str = ""
    model: str = ""
    promptVersion: str = ""