"""
心理测评数据模型模块

提供心理测评相关的 Pydantic 模型定义
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Any

from pydantic import BaseModel, Field, field_validator


class MoodType(str, Enum):
    """情绪类型枚举"""
    HAPPY = "happy"
    EXCITED = "excited"
    CALM = "calm"
    ANXIOUS = "anxious"
    DEPRESSED = "depressed"
    ANGRY = "angry"
    SAD = "sad"
    STRESSED = "stressed"
    TIRED = "tired"
    CONFUSED = "confused"


class AssessmentRequest(BaseModel):
    """
    心理测评请求模型
    
    用于情绪分析、心理评估等接口的请求参数
    """
    content: str = Field(
        ...,
        description="情绪描述内容",
        min_length=1,
        max_length=2000,
        examples=["最近考试压力很大，总是睡不好觉"]
    )
    mood_level: int = Field(
        ...,
        description="情绪强度等级 (1-10)",
        ge=1,
        le=10,
        examples=[7]
    )
    mood_type: Optional[str] = Field(
        default=None,
        description="情绪类型",
        examples=["anxious"]
    )
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        """验证内容不为空"""
        if not v or not v.strip():
            raise ValueError('情绪描述不能为空')
        return v.strip()


class AssessmentResponse(BaseModel):
    """
    心理测评响应模型
    
    情绪分析、心理评估等接口的返回结果
    """
    analysis: str = Field(
        ...,
        description="情绪分析结果",
        examples=["你目前处于轻度焦虑状态，主要源于考试压力"]
    )
    suggestions: List[str] = Field(
        ...,
        description="情绪疏导建议列表",
        min_length=1,
        max_length=10,
        examples=[[
            "尝试深呼吸放松练习",
            "制定合理的复习计划",
            "保证充足的睡眠时间"
        ]]
    )
    mood_score: Optional[int] = Field(
        default=None,
        description="情绪评分 (1-100)",
        ge=1,
        le=100
    )
    risk_level: Optional[str] = Field(
        default=None,
        description="风险等级: low/medium/high",
        pattern="^(low|medium|high)$"
    )
    mood: Optional[str] = Field(
        default="未知",
        description="情绪标签",
        examples=["开心", "焦虑", "抑郁", "平静", "愤怒", "疲惫", "紧张", "兴奋"]
    )
    
    @field_validator('suggestions')
    @classmethod
    def validate_suggestions(cls, v: List[str]) -> List[str]:
        """验证建议列表"""
        if not v:
            raise ValueError('建议列表不能为空')
        return [s.strip() for s in v if s.strip()]


class Questionnaire(BaseModel):
    """
    问卷模型
    
    心理测评问卷的基础信息
    """
    id: str = Field(..., description="问卷ID")
    title: str = Field(..., description="问卷标题")
    description: Optional[str] = Field(default=None, description="问卷描述")
    category: str = Field(..., description="问卷类别")
    question_count: int = Field(default=0, description="题目数量")
    estimated_time: Optional[int] = Field(default=None, description="预计完成时间(分钟)")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class Question(BaseModel):
    """
    题目模型
    
    问卷中的单个题目
    """
    id: str = Field(..., description="题目ID")
    questionnaire_id: str = Field(..., description="所属问卷ID")
    content: str = Field(..., description="题目内容")
    type: str = Field(default="single", description="题目类型: single/multiple/text")
    order: int = Field(default=0, description="题目顺序")
    options: Optional[List[dict]] = Field(default=None, description="选项列表")
    score_rules: Optional[dict] = Field(default=None, description="计分规则")
    is_required: bool = Field(default=True, description="是否必填")


class Answer(BaseModel):
    """
    答案模型
    
    用户对某个题目的回答
    """
    question_id: str = Field(..., description="题目ID")
    selected_options: Optional[List[str]] = Field(default=None, description="选择的选项")
    text_answer: Optional[str] = Field(default=None, description="文本答案")
    score: Optional[int] = Field(default=None, description="该题得分")


class AssessmentResult(BaseModel):
    """
    测评结果模型
    
    用户完成测评后的完整结果
    """
    id: str = Field(..., description="结果ID")
    user_id: str = Field(..., description="用户ID")
    questionnaire_id: str = Field(..., description="问卷ID")
    answers: List[Answer] = Field(default=[], description="答案列表")
    total_score: Optional[int] = Field(default=None, description="总得分")
    max_score: Optional[int] = Field(default=None, description="满分")
    result_category: Optional[str] = Field(default=None, description="结果类别")
    result_description: Optional[str] = Field(default=None, description="结果描述")
    suggestions: Optional[List[str]] = Field(default=None, description="建议")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    
    @property
    def score_percentage(self) -> Optional[float]:
        """计算得分百分比"""
        if self.total_score is not None and self.max_score and self.max_score > 0:
            return round(self.total_score / self.max_score * 100, 2)
        return None


class AssessmentHistory(BaseModel):
    """
    测评历史记录模型
    
    用户的测评历史摘要
    """
    id: str = Field(..., description="记录ID")
    user_id: str = Field(..., description="用户ID")
    questionnaire_title: str = Field(..., description="问卷标题")
    total_score: int = Field(..., description="得分")
    result_category: str = Field(..., description="结果类别")
    completed_at: datetime = Field(..., description="完成时间")


class AssessmentStatistics(BaseModel):
    """
    测评统计模型
    
    用户测评数据的统计分析
    """
    user_id: str = Field(..., description="用户ID")
    total_assessments: int = Field(default=0, description="测评次数")
    average_score: Optional[float] = Field(default=None, description="平均分")
    trend: Optional[str] = Field(default=None, description="趋势: improving/stable/declining")
    last_assessment_date: Optional[datetime] = Field(default=None, description="最近测评时间")
    primary_concerns: Optional[List[str]] = Field(default=None, description="主要关注点")


# 向后兼容的别名（用于迁移过渡期）
MoodRequest = AssessmentRequest
MoodAnalysisResponse = AssessmentResponse
