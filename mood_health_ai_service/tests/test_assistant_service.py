"""Tests for the assistant module's intentionally thin public facade."""

import pytest
from pydantic import ValidationError

from app.assistant.service import generate_assistant_response
from app.models.contracts import AssistantResponse, AssistantResponseRequest


def test_assistant_request_rejects_blank_and_oversized_queries() -> None:
    with pytest.raises(ValidationError):
        AssistantResponseRequest(query=" ", requestId="r1")
    with pytest.raises(ValidationError):
        AssistantResponseRequest(query="x" * 1001, requestId="r1")


@pytest.mark.asyncio
async def test_public_service_delegates_to_agent_graph(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = AssistantResponseRequest(
        query="I need support",
        requestId="facade",
        allowWebSearch=True,
    )
    expected = AssistantResponse(
        answer="final answer",
        sources=[],
        groundingUsed=False,
        webSearchStatus="not_needed",
        requestId="facade",
        provider="deepseek",
        model="deepseek-v4-flash",
        fallbackUsed=False,
    )
    seen: list[AssistantResponseRequest] = []

    async def fake_run_agent(value: AssistantResponseRequest) -> AssistantResponse:
        seen.append(value)
        return expected

    monkeypatch.setattr("app.assistant.service.run_assistant_agent", fake_run_agent)

    result = await generate_assistant_response(request)

    assert result is expected
    assert seen == [request]
