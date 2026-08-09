import pytest
from pydantic import ValidationError

from app.config import Settings
from app.models.contracts import (
    AssistantResponse,
    AssistantResponseRequest,
    RagAnswerResponse,
    RagSource,
)


def test_agent_settings_use_approved_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "AI_MODEL",
        "TAVILY_API_KEY",
        "TAVILY_TIMEOUT_SECONDS",
        "TAVILY_MAX_RESULTS",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.AI_MODEL == "deepseek-v4-flash"
    assert settings.TAVILY_API_KEY == ""
    assert settings.TAVILY_TIMEOUT_SECONDS == 10.0
    assert settings.TAVILY_MAX_RESULTS == 5


@pytest.mark.parametrize("maximum", [1, 5])
def test_tavily_max_results_accepts_only_approved_range(maximum: int) -> None:
    settings = Settings(_env_file=None, TAVILY_MAX_RESULTS=maximum)

    assert maximum == settings.TAVILY_MAX_RESULTS


@pytest.mark.parametrize("maximum", [0, 6])
def test_tavily_max_results_rejects_values_outside_approved_range(maximum: int) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, TAVILY_MAX_RESULTS=maximum)


@pytest.mark.parametrize("timeout", [0, -1, 30.01])
def test_tavily_timeout_rejects_non_positive_or_uncapped_values(timeout: float) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, TAVILY_TIMEOUT_SECONDS=timeout)


def test_tavily_timeout_accepts_positive_cap() -> None:
    assert Settings(_env_file=None, TAVILY_TIMEOUT_SECONDS=30).TAVILY_TIMEOUT_SECONDS == 30


@pytest.mark.parametrize("allow_web_search", [True, False])
def test_assistant_request_serializes_strict_web_search_flag(
    allow_web_search: bool,
) -> None:
    request = AssistantResponseRequest(
        query="需要最新资料",
        requestId="request-1",
        allowWebSearch=allow_web_search,
    )

    assert request.allowWebSearch is allow_web_search
    assert request.model_dump(mode="json") == {
        "query": "需要最新资料",
        "requestId": "request-1",
        "history": [],
        "riskDetected": False,
        "allowWebSearch": allow_web_search,
    }


def test_assistant_request_defaults_web_search_to_false() -> None:
    request = AssistantResponseRequest(query="只用本地知识", requestId="request-2")

    assert request.allowWebSearch is False


@pytest.mark.parametrize("invalid", ["true", 1, None])
def test_assistant_request_rejects_coerced_web_search_values(invalid: object) -> None:
    with pytest.raises(ValidationError):
        AssistantResponseRequest(
            query="需要资料",
            requestId="request-3",
            allowWebSearch=invalid,
        )


def test_assistant_request_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        AssistantResponseRequest(
            query="需要资料",
            requestId="request-4",
            allowWebSearch=False,
            searchDepth="advanced",
        )


def test_rag_source_defaults_to_local_and_preserves_legacy_fields() -> None:
    source = RagSource(title="睡眠卫生", reference="本地知识清单")

    assert source.model_dump(mode="json") == {
        "sourceType": "local",
        "title": "睡眠卫生",
        "reference": "本地知识清单",
        "url": None,
    }

    response = RagAnswerResponse(
        answer="保持规律作息。",
        sources=[source],
        requestId="request-5",
        provider="deepseek",
        model="deepseek-v4-flash",
    )
    assert response.sources[0].sourceType == "local"


def test_web_source_accepts_https_url_and_serializes_it_as_string() -> None:
    source = RagSource(
        sourceType="web",
        title="官方资料",
        reference="国家卫生健康委",
        url="https://www.nhc.gov.cn/example?id=1",
    )

    assert source.model_dump(mode="json") == {
        "sourceType": "web",
        "title": "官方资料",
        "reference": "国家卫生健康委",
        "url": "https://www.nhc.gov.cn/example?id=1",
    }


@pytest.mark.parametrize("url", ["http://example.com", "not-a-url"])
def test_source_rejects_non_https_or_invalid_url(url: str) -> None:
    with pytest.raises(ValidationError):
        RagSource(
            sourceType="web",
            title="网页资料",
            reference="网页",
            url=url,
        )


def _assistant_response_payload() -> dict[str, object]:
    return {
        "answer": "可以先从规律作息开始。",
        "sources": [],
        "groundingUsed": False,
        "requestId": "request-6",
        "provider": "deepseek",
        "model": "deepseek-v4-flash",
    }


@pytest.mark.parametrize(
    "status",
    ["not_requested", "not_needed", "used", "failed"],
)
def test_assistant_response_accepts_and_serializes_every_web_search_status(
    status: str,
) -> None:
    response = AssistantResponse(**_assistant_response_payload(), webSearchStatus=status)

    assert response.model_dump(mode="json")["webSearchStatus"] == status


def test_assistant_response_requires_web_search_status() -> None:
    with pytest.raises(ValidationError):
        AssistantResponse(**_assistant_response_payload())
