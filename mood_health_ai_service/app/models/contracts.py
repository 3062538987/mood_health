"""
FastAPI 情绪分析合同 — 唯一接口定义。

Node 发送请求体，FastAPI 返回响应体。两端共用此合同。
额外字段拒绝 (extra='forbid')，禁止 mood_score/confidence/diagnosis。
"""

from typing import Annotated, Literal

from pydantic import AnyUrl, BaseModel, Field, StrictBool, UrlConstraints, field_validator

# ---- 请求 ----

Period = Literal["7d", "1m", "3m", "6m", "1y"]
HttpsUrl = Annotated[AnyUrl, UrlConstraints(allowed_schemes=["https"])]


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
    metrics: list[MetricPoint] = Field(default_factory=list)
    trend: list[TrendPoint] = Field(default_factory=list)
    triggers: list[str] = Field(default_factory=list, max_length=100)

    # 日记正文（本次可选授权）
    journalExcerpt: str | None = Field(default=None, max_length=5000)
    journalConsent: bool = Field(default=False)


# ---- 响应 ----

class PatternItem(BaseModel):
    """情绪模式"""
    model_config = {"extra": "forbid"}

    title: str
    observation: str
    evidence: str
    caveat: str | None = None


class ActionItem(BaseModel):
    """行动建议"""
    model_config = {"extra": "forbid"}

    title: str
    steps: list[str] = Field(default_factory=list)
    estimatedMinutes: int | None = Field(default=None, ge=1)


class MoodAnalysisResponse(BaseModel):
    """情绪分析响应 — 固定结构，禁止额外字段"""
    model_config = {"extra": "forbid"}

    summary: str
    patterns: list[PatternItem] = Field(default_factory=list)
    possibleFactors: list[str] = Field(default_factory=list)
    actions: list[ActionItem] = Field(default_factory=list)
    whenToSeekHelp: str | None = None
    warnings: list[str] = Field(default_factory=list)

    # 来源溯源
    provider: str = ""
    model: str = ""
    promptVersion: str = ""


# ---- 通用 AI 对话 ----

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    model_config = {"extra": "forbid"}
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    maxTokens: int | None = Field(default=None, ge=1, le=8192)

class ChatResponse(BaseModel):
    content: str
    model: str = ""
    usage: dict[str, int] | None = None


# ---- RAG knowledge assistant ----


class RagHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class RagAnswerRequest(BaseModel):
    model_config = {"extra": "forbid"}

    query: str = Field(..., min_length=1, max_length=1000)
    requestId: str = Field(..., min_length=1, max_length=128)
    history: list[RagHistoryMessage] = Field(default_factory=list, max_length=10)

    @field_validator("query", "requestId")
    @classmethod
    def strip_non_empty_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class RagSource(BaseModel):
    sourceType: Literal["local", "web"] = "local"
    title: str
    reference: str
    url: HttpsUrl | None = None


class RagAnswerResponse(BaseModel):
    answer: str
    sources: list[RagSource] = Field(default_factory=list, max_length=3)
    requestId: str
    provider: str
    model: str
    usage: dict[str, int] | None = None
    fallbackUsed: Literal[False] = False


# ---- Unified psychological assistant ----


class AssistantHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class AssistantResponseRequest(BaseModel):
    model_config = {"extra": "forbid"}

    query: str = Field(..., min_length=1, max_length=1000)
    requestId: str = Field(..., min_length=1, max_length=128)
    history: list[AssistantHistoryMessage] = Field(default_factory=list, max_length=10)
    riskDetected: bool = False
    allowWebSearch: StrictBool = False

    @field_validator("query", "requestId")
    @classmethod
    def strip_assistant_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class AssistantResponse(BaseModel):
    answer: str
    sources: list[RagSource] = Field(default_factory=list, max_length=3)
    groundingUsed: bool
    webSearchStatus: Literal["not_requested", "not_needed", "used", "failed"]
    requestId: str
    provider: str
    model: str
    usage: dict[str, int] | None = None
    fallbackUsed: Literal[False] = False
