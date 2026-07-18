"""
AI Provider 与严格输出验证测试。
不依赖真实 API 调用。
"""

import pytest

from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse
from app.providers.validator import validate_analysis_response


class TestValidateAnalysisResponse:
    def test_valid_full(self):
        raw = {
            "summary": "情绪平稳。",
            "patterns": [
                {
                    "title": "学业压力",
                    "observation": "强度偏低。",
                    "evidence": "3天记录。",
                    "caveat": "样本小。",
                }
            ],
            "possibleFactors": ["学业"],
            "actions": [
                {
                    "title": "休息",
                    "steps": ["深呼吸"],
                    "estimatedMinutes": 5,
                }
            ],
            "whenToSeekHelp": "如持续两周请咨询。",
            "warnings": ["样本量小"],
        }
        result = validate_analysis_response(raw, "req-001")
        assert isinstance(result, MoodAnalysisResponse)
        assert result.summary == "情绪平稳。"
        assert result.patterns[0].title == "学业压力"

    def test_valid_minimal(self):
        """最小合法响应"""
        raw = {"summary": "数据不足，无法生成分析。"}
        result = validate_analysis_response(raw, "req-001")
        assert result.summary == "数据不足，无法生成分析。"
        assert result.patterns == []

    def test_rejects_mood_score(self):
        raw = {"summary": "ok", "mood_score": 5}
        with pytest.raises(ValueError, match="禁止字段"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_confidence(self):
        raw = {"summary": "ok", "confidence": 0.9}
        with pytest.raises(ValueError, match="禁止字段"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_diagnosis(self):
        raw = {"summary": "ok", "diagnosis": "anxiety"}
        with pytest.raises(ValueError, match="禁止字段"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_extra_fields(self):
        raw = {"summary": "ok", "extraField": "nope"}
        with pytest.raises(ValueError, match="输出格式不符合合同"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_missing_summary(self):
        raw = {}
        with pytest.raises(ValueError, match="输出格式不符合合同"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_invalid_pattern_structure(self):
        raw = {
            "summary": "ok",
            "patterns": [{"title": "test"}],  # 缺少 observation, evidence
        }
        with pytest.raises(ValueError, match="输出格式不符合合同"):
            validate_analysis_response(raw, "req-001")

    def test_rejects_invalid_action_structure(self):
        raw = {
            "summary": "ok",
            "actions": [{"title": "test", "steps": "not-a-list"}],  # steps 不是 list
        }
        with pytest.raises(ValueError, match="输出格式不符合合同"):
            validate_analysis_response(raw, "req-001")