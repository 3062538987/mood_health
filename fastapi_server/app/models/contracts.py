from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Union


class MetricPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    emotionName: str
    emotionCategory: Literal["positive", "negative", "neutral"]
    intensity: float = Field(..., ge=1, le=10)
    count: int = Field(..., ge=1)


class TrendPoint(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    avgIntensity: float = Field(..., ge=1, le=10)
    dominantEmotion: str
    recordCount: int = Field(..., ge=1)


class MoodAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contractVersion: str
    requestId: str
    period: Literal["7d", "1m", "3m", "6m", "1y"]
    dataVersion: str
    locale: str = "zh-CN"
    metrics: List[MetricPoint]
    trend: List[TrendPoint]
    triggers: List[str] = []
    journalExcerpt: Optional[str] = None
    journalConsent: bool = False


class PatternItem(BaseModel):
    title: str
    observation: str
    evidence: str
    caveat: Optional[str] = None


class ActionItem(BaseModel):
    title: str
    steps: List[str]
    estimatedMinutes: Optional[int] = None


class MoodAnalysisResponse(BaseModel):
    summary: str
    patterns: List[PatternItem]
    possibleFactors: List[str]
    actions: List[ActionItem]
    whenToSeekHelp: Optional[str] = None
    warnings: List[str] = []
    provider: str
    model: str
    promptVersion: str