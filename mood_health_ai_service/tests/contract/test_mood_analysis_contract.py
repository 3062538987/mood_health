"""
FastAPI 情绪分析合同测试 — 验证请求/响应 Pydantic 模型。
两端 (Python + Node) 必须对同一 JSON 产生一致的接受/拒绝结果。
"""

import copy

import pytest
from pydantic import ValidationError

from app.models.contracts import (
    MoodAnalysisRequest as Request,
)
from app.models.contracts import (
    MoodAnalysisResponse as Response,
)

VALID_REQUEST = {
    "requestId": "req-001",
    "period": "7d",
    "dataVersion": "v1",
    "metrics": [
        {
            "date": "2026-07-01",
            "emotionName": "开心",
            "emotionCategory": "positive",
            "intensity": 7.5,
            "count": 2,
        }
    ],
    "trend": [
        {
            "date": "2026-07-01",
            "avgIntensity": 7.5,
            "dominantEmotion": "开心",
            "recordCount": 2,
        }
    ],
    "triggers": ["学业", "社交"],
    "journalExcerpt": None,
    "journalConsent": False,
}

VALID_RESPONSE = {
    "summary": "最近7天情绪总体平稳。",
    "patterns": [
        {
            "title": "学业压力",
            "observation": "在学业相关记录中情绪强度偏低。",
            "evidence": "7天中有3天记录涉及学业触发因素。",
            "caveat": "样本量较小，仅供参考。",
        }
    ],
    "possibleFactors": ["学业压力", "社交关系"],
    "actions": [
        {
            "title": "短暂休息",
            "steps": ["放下当前任务", "做5分钟深呼吸"],
            "estimatedMinutes": 5,
        }
    ],
    "whenToSeekHelp": "如果低落情绪持续超过两周，建议联系辅导员。",
    "warnings": ["样本量较小 (7天)，分析结论仅供参考。"],
    "provider": "deepseek",
    "model": "deepseek-chat",
    "promptVersion": "1.0.0",
}


class TestMoodAnalysisRequest:
    """请求合同：合法/拒绝/边界"""

    def test_valid_minimal(self):
        """最小合法请求通过"""
        req = Request(
            requestId="req-001",
            period="7d",
            dataVersion="v1",
        )
        assert req.period == "7d"

    def test_valid_full(self):
        """完整请求通过"""
        req = Request(**VALID_REQUEST)
        assert req.requestId == "req-001"
        assert len(req.metrics) == 1
        assert req.journalExcerpt is None

    def test_valid_all_periods(self):
        """五周期全部接受"""
        for p in ["7d", "1m", "3m", "6m", "1y"]:
            req = Request(requestId="r", period=p, dataVersion="v1")
            assert req.period == p

    def test_rejects_invalid_period(self):
        """非法周期被拒绝"""
        with pytest.raises(ValidationError):
            Request(requestId="r", period="week", dataVersion="v1")

    def test_rejects_extra_fields(self):
        """extra='forbid' 拒绝额外字段"""
        with pytest.raises(ValidationError):
            Request(requestId="r", period="7d", dataVersion="v1", userId=1)

    def test_rejects_mood_score(self):
        """请求不允许 mood_score 字段"""
        payload = {**VALID_REQUEST, "mood_score": 5}
        with pytest.raises(ValidationError):
            Request(**payload)

    def test_rejects_confidence(self):
        """请求不允许 confidence 字段"""
        payload = {**VALID_REQUEST, "confidence": 0.9}
        with pytest.raises(ValidationError):
            Request(**payload)

    def test_rejects_diagnosis(self):
        """请求不允许 diagnosis 字段"""
        payload = {**VALID_REQUEST, "diagnosis": "depression"}
        with pytest.raises(ValidationError):
            Request(**payload)

    def test_rejects_empty_requestId(self):
        """requestId 不能为空"""
        with pytest.raises(ValidationError):
            Request(requestId="", period="7d", dataVersion="v1")

    def test_rejects_intensity_out_of_range(self):
        """intensity 必须在 1-10"""
        bad = copy.deepcopy(VALID_REQUEST)
        bad["metrics"][0]["intensity"] = 0
        with pytest.raises(ValidationError):
            Request(**bad)
        bad["metrics"][0]["intensity"] = 11
        with pytest.raises(ValidationError):
            Request(**bad)

    def test_journalExcerpt_null_when_no_consent(self):
        """未授权时 journalExcerpt 必须为 null"""
        req = Request(**{**VALID_REQUEST, "journalConsent": False, "journalExcerpt": None})
        assert req.journalExcerpt is None

    def test_journalExcerpt_allowed_when_consent(self):
        """授权时可以携带日记"""
        req = Request(
            **{**VALID_REQUEST, "journalConsent": True, "journalExcerpt": "今天有点累"}
        )
        assert req.journalExcerpt == "今天有点累"

    def test_json_roundtrip(self):
        """JSON 序列化/反序列化一致"""
        req = Request(**VALID_REQUEST)
        json_str = req.model_dump_json()
        reloaded = Request.model_validate_json(json_str)
        assert reloaded.requestId == req.requestId
        assert reloaded.period == req.period


class TestMoodAnalysisResponse:
    """响应合同：合法/拒绝"""

    def test_valid_minimal(self):
        """最小合法响应通过"""
        resp = Response(summary="ok")
        assert resp.summary == "ok"
        assert resp.patterns == []

    def test_valid_full(self):
        """完整响应通过"""
        resp = Response(**VALID_RESPONSE)
        assert len(resp.patterns) == 1
        assert resp.provider == "deepseek"

    def test_rejects_mood_score(self):
        """响应不允许 mood_score"""
        payload = {**VALID_RESPONSE, "mood_score": 5}
        with pytest.raises(ValidationError):
            Response(**payload)

    def test_rejects_confidence(self):
        """响应不允许 confidence"""
        payload = {**VALID_RESPONSE, "confidence": 0.85}
        with pytest.raises(ValidationError):
            Response(**payload)

    def test_rejects_diagnosis(self):
        """响应不允许 diagnosis"""
        payload = {**VALID_RESPONSE, "diagnosis": "anxiety"}
        with pytest.raises(ValidationError):
            Response(**payload)

    def test_rejects_extra_fields(self):
        """响应拒绝额外字段"""
        payload = {**VALID_RESPONSE, "extraField": "nope"}
        with pytest.raises(ValidationError):
            Response(**payload)

    def test_json_roundtrip(self):
        """JSON 序列化/反序列化一致"""
        resp = Response(**VALID_RESPONSE)
        json_str = resp.model_dump_json()
        reloaded = Response.model_validate_json(json_str)
        assert reloaded.summary == resp.summary
        assert reloaded.patterns[0].title == resp.patterns[0].title


class TestCrossContract:
    """跨合同一致性"""

    def test_extra_fields_blocked_on_both_sides(self):
        """两端对额外字段的处理一致 — 均拒绝"""
        with pytest.raises(ValidationError):
            Request(requestId="r", period="7d", dataVersion="v1", banned=42)
        with pytest.raises(ValidationError):
            Response(summary="ok", banned=42)

    def test_no_user_id_leak(self):
        """请求不能包含 userId"""
        payload = {**VALID_REQUEST, "userId": 123}
        with pytest.raises(ValidationError):
            Request(**payload)

    def test_no_token_leak(self):
        """请求不能包含 token/cookie"""
        for field in ["token", "cookie", "email"]:
            payload = {**VALID_REQUEST, field: "secret"}
            with pytest.raises(ValidationError):
                Request(**payload)
