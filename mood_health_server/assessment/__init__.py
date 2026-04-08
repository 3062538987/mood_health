"""
心理测评模块

提供心理测评问卷、评分、结果分析等功能
"""

from .models import (
    # 枚举
    MoodType,
    # 核心模型
    AssessmentRequest,
    AssessmentResponse,
    # 问卷相关
    Questionnaire,
    Question,
    Answer,
    AssessmentResult,
    AssessmentHistory,
    AssessmentStatistics,
    # 向后兼容别名
    MoodRequest,
    MoodAnalysisResponse,
)
from .service import (
    AssessmentService,
    calculate_score,
    generate_report,
)
from .router import router, register_legacy_routes

__all__ = [
    # Enums
    "MoodType",
    # Core Models
    "AssessmentRequest",
    "AssessmentResponse",
    # Questionnaire Models
    "Questionnaire",
    "Question",
    "Answer",
    "AssessmentResult",
    "AssessmentHistory",
    "AssessmentStatistics",
    # Backward Compatibility
    "MoodRequest",
    "MoodAnalysisResponse",
    # Service
    "AssessmentService",
    "calculate_score",
    "generate_report",
    # Router
    "router",
    "register_legacy_routes",
]
