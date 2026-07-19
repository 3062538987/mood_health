import os
import hmac
import hashlib
import time
import json
import pytest
import pytest_asyncio
from httpx import AsyncClient

TOKEN = os.environ["AI_SERVICE_INTERNAL_TOKEN"]


def make_auth_headers(body: dict) -> dict:
    body_str = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    timestamp = str(int(time.time()))
    message = f"{body_str}{timestamp}{TOKEN}"
    signature = hmac.new(
        TOKEN.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "X-Nonce": "test-nonce-001",
    }


@pytest.fixture
def valid_request():
    return {
        "contractVersion": "1.0.0",
        "requestId": "test-req-001",
        "period": "7d",
        "dataVersion": "v1",
        "locale": "zh-CN",
        "metrics": [
            {
                "date": "2026-07-15",
                "emotionName": "开心",
                "emotionCategory": "positive",
                "intensity": 7.0,
                "count": 3,
            },
            {
                "date": "2026-07-14",
                "emotionName": "焦虑",
                "emotionCategory": "negative",
                "intensity": 5.0,
                "count": 1,
            },
        ],
        "trend": [
            {
                "date": "2026-07-15",
                "avgIntensity": 7.0,
                "dominantEmotion": "开心",
                "recordCount": 3,
            },
            {
                "date": "2026-07-14",
                "avgIntensity": 5.0,
                "dominantEmotion": "焦虑",
                "recordCount": 1,
            },
        ],
        "triggers": ["工作压力", "人际关系"],
        "journalExcerpt": None,
        "journalConsent": False,
    }


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_ready(client: AsyncClient):
    resp = await client.get("/api/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_analyze_mood_valid(client: AsyncClient, valid_request):
    resp = await client.post(
        "/api/analyze/mood",
        json=valid_request,
        headers=make_auth_headers(valid_request),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert "patterns" in data
    assert len(data["patterns"]) >= 1
    assert "possibleFactors" in data
    assert "actions" in data
    assert data["provider"] == "mood_health_ai_service"
    assert data["model"] == "mood-analyzer-v1"
    assert "mood_score" not in data
    assert "confidence" not in data
    assert "diagnosis" not in data


@pytest.mark.asyncio
async def test_analyze_mood_missing_auth(client: AsyncClient, valid_request):
    resp = await client.post("/api/analyze/mood", json=valid_request)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_analyze_mood_invalid_metric(client: AsyncClient, valid_request):
    bad = {**valid_request, "metrics": [{"date": "2026-07-15", "emotionName": "x", "emotionCategory": "positive", "intensity": 15, "count": 1}]}
    resp = await client.post(
        "/api/analyze/mood",
        json=bad,
        headers=make_auth_headers(bad),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_mood_extra_fields_rejected(client: AsyncClient, valid_request):
    bad = {**valid_request, "mood_score": 85}
    resp = await client.post(
        "/api/analyze/mood",
        json=bad,
        headers=make_auth_headers(bad),
    )
    assert resp.status_code == 422