import json

import pytest
from fastapi.testclient import TestClient

from app.auth import generate_auth_headers
from app.config import get_settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_rag_endpoint_requires_internal_auth(client: TestClient) -> None:
    response = client.post(
        "/api/rag/answer",
        json={"query": "睡眠", "requestId": "r1"},
    )

    assert response.status_code == 401


def test_rag_endpoint_returns_answer_and_retrieved_sources(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = "test-internal-token"
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", token)
    get_settings.cache_clear()

    async def accept_nonce(nonce: str) -> tuple[bool, str]:
        return True, ""

    async def fake_answer(request):
        return {
            "answer": "保持规律作息。",
            "sources": [{"title": "睡眠卫生", "reference": "国家卫健委"}],
            "requestId": request.requestId,
            "provider": "deepseek",
            "model": "deepseek-chat",
            "usage": None,
            "fallbackUsed": False,
        }

    monkeypatch.setattr("app.auth.verify_nonce", accept_nonce)
    monkeypatch.setattr("app.routers.rag.answer_question", fake_answer)
    body = {"query": "怎样改善睡眠", "requestId": "r1", "history": []}
    raw_body = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    headers = {
        **generate_auth_headers(raw_body, token),
        "Content-Type": "application/json",
    }

    response = client.post("/api/rag/answer", content=raw_body.encode("utf-8"), headers=headers)

    assert response.status_code == 200
    assert response.json()["sources"][0]["reference"] == "国家卫健委"
    assert response.json()["fallbackUsed"] is False
