"""版本化 AI 评测集与评分表。

用法:
    from eval import load_dataset, score_response

    dataset = load_dataset("v1", "mood_analysis")
    for case in dataset.cases:
        response = provider.analyze(case.request)
        result = score_response(case, response)
        assert result.passed
"""

from eval.loader import list_datasets, list_versions, load_dataset
from eval.scoring import (
    score_content_audit,
    score_crisis_detection,
    score_mood_analysis,
)
from eval.schemas import ContentAuditCase, CrisisDetectionCase, MoodAnalysisCase

__version__ = "1.0.0"


def score_response(case, response):
    """根据用例类型分派到对应评分函数。"""
    if isinstance(case, MoodAnalysisCase):
        return score_mood_analysis(case, response)
    if isinstance(case, CrisisDetectionCase):
        return score_crisis_detection(case, response)
    if isinstance(case, ContentAuditCase):
        return score_content_audit(case, response)
    raise TypeError(f"Unsupported case type: {type(case).__name__}")


__all__ = [
    "load_dataset",
    "list_datasets",
    "list_versions",
    "score_response",
    "score_mood_analysis",
    "score_crisis_detection",
    "score_content_audit",
    "MoodAnalysisCase",
    "CrisisDetectionCase",
    "ContentAuditCase",
]
