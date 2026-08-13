"""
R1 回归测试：/api/analyze/mood 与 /api/ai/chat 现在必须携带有效 HMAC 签名，
否则返回 401。验证后端→AI 链路的鉴权闸门已闭合（不匹配签名 → 401）。
"""

from fastapi.testclient import TestClient

ANALYZE_BODY = (
    '{"contractVersion":"1.0.0","requestId":"x","period":"7d",'
    '"metrics":[],"trend":[],"triggers":[]}'
)


def _make_client(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-token")
    from app.config import get_settings

    get_settings.cache_clear()
    # 避免触发 lifespan 内的启动校验 / 外部连接
    from app.main import app

    return TestClient(app)


def test_analyze_requires_signature(monkeypatch):
    client = _make_client(monkeypatch)
    resp = client.post("/api/analyze/mood", json={"contractVersion": "1.0.0"})
    assert resp.status_code == 401


def test_chat_requires_signature(monkeypatch):
    client = _make_client(monkeypatch)
    resp = client.post("/api/ai/chat", json={"messages": []})
    assert resp.status_code == 401


def test_analyze_passes_with_valid_signature(monkeypatch):
    from app.auth import generate_auth_headers

    client = _make_client(monkeypatch)
    body = ANALYZE_BODY
    headers = generate_auth_headers(body, "test-token")
    resp = client.post("/api/analyze/mood", content=body, headers=headers)
    # 鉴权通过后才走到下游（AI_API_KEY 缺失 → 500，或校验 → 422）；绝不能是 401
    assert resp.status_code != 401


def test_analyze_rejects_wrong_signature(monkeypatch):
    from app.auth import generate_auth_headers

    client = _make_client(monkeypatch)
    body = ANALYZE_BODY
    headers = generate_auth_headers(body, "wrong-token")
    resp = client.post("/api/analyze/mood", content=body, headers=headers)
    assert resp.status_code == 401
