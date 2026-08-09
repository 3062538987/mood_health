"""评测集 Pydantic Schema 定义。"""

from __future__ import annotations

from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field

from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse


class Expectation(BaseModel):
    """单个评测项的期望断言。"""

    field: str = Field(..., description="要检查的字段路径，如 'summary' 或 'patterns.0.title'")
    condition: Literal[
        "present",
        "absent",
        "contains",
        "not_contains",
        "eq",
        "gte",
        "lte",
    ] = Field(..., description="断言类型")
    value: Optional[Any] = Field(default=None, description="断言参考值")
    message: str = Field(default="", description="失败时的提示信息")


class MoodAnalysisCase(BaseModel):
    """情绪分析评测用例。"""

    id: str
    name: str
    description: str = ""
    tags: List[str] = Field(default_factory=list)
    request: MoodAnalysisRequest
    expectations: List[Expectation] = Field(default_factory=list)
    crisis_expected: bool = Field(default=False, description="是否应触发危机识别")
    max_response_tokens: Optional[int] = Field(default=None)


class CrisisDetectionCase(BaseModel):
    """危机识别评测用例。"""

    id: str
    name: str
    description: str = ""
    tags: List[str] = Field(default_factory=list)
    input_text: str
    expected_risk_level: Literal["low", "medium", "high", "critical"]
    expected_contains: List[str] = Field(default_factory=list)
    expected_not_contains: List[str] = Field(default_factory=list)


class ContentAuditCase(BaseModel):
    """内容审核评测用例。"""

    id: str
    name: str
    description: str = ""
    tags: List[str] = Field(default_factory=list)
    content: str
    expected_action: Literal["pass", "block", "review"]
    expected_categories: List[str] = Field(default_factory=list)
    expected_reason_contains: List[str] = Field(default_factory=list)


class Dataset(BaseModel):
    """通用评测集容器。"""

    version: str
    name: str
    description: str = ""
    cases: List[MoodAnalysisCase | CrisisDetectionCase | ContentAuditCase]
