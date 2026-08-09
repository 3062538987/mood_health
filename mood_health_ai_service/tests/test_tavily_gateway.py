"""Bounded Tavily gateway tests. All provider behavior is faked locally."""

from __future__ import annotations

import ast
import asyncio
import inspect
import logging
from collections.abc import Callable
from dataclasses import asdict
from typing import Any

import pytest
from langchain_tavily import TavilySearch
from langchain_tavily.tavily_search import TavilySearchAPIWrapper

from app.agent import tavily_gateway as tavily_gateway_module
from app.agent.tavily_gateway import TavilySearchGateway
from app.config import Settings


class FakeTool:
    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.invocations: list[dict[str, str]] = []

    async def ainvoke(self, payload: dict[str, str]) -> object:
        self.invocations.append(payload)
        if self.error is not None:
            raise self.error
        return self.response


class BlockingTool(FakeTool):
    async def ainvoke(self, payload: dict[str, str]) -> object:
        self.invocations.append(payload)
        await asyncio.sleep(60)
        return {"results": []}


def make_gateway(
    tool: FakeTool,
    *,
    api_key: str = "test-tavily-secret",
    timeout: float = 1.0,
    max_results: int = 5,
) -> tuple[TavilySearchGateway, list[dict[str, Any]]]:
    constructor_calls: list[dict[str, Any]] = []

    def factory(**options: Any) -> FakeTool:
        constructor_calls.append(options)
        return tool

    settings = Settings(
        _env_file=None,
        TAVILY_API_KEY=api_key,
        TAVILY_TIMEOUT_SECONDS=timeout,
        TAVILY_MAX_RESULTS=max_results,
    )
    return TavilySearchGateway(settings=settings, tool_factory=factory), constructor_calls


@pytest.mark.asyncio
async def test_search_uses_fixed_cost_privacy_options_and_invokes_once() -> None:
    tool = FakeTool(
        {"results": [{"title": "Official update", "url": "https://example.org/a", "content": "A"}]}
    )
    gateway, constructor_calls = make_gateway(tool, max_results=4)

    result = await gateway.search("  recent   mental health\nupdates  ")

    assert result.status == "used"
    assert tool.invocations == [{"query": "recent mental health updates"}]
    assert len(constructor_calls) == 1
    options = constructor_calls[0]
    wrapper = options.pop("api_wrapper")
    assert isinstance(wrapper, TavilySearchAPIWrapper)
    assert wrapper.tavily_api_key.get_secret_value() == "test-tavily-secret"
    assert options == {
        "search_depth": "basic",
        "max_results": 4,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
        "include_image_descriptions": False,
        "include_favicon": False,
        "include_usage": False,
        "auto_parameters": False,
        "topic": "general",
    }


@pytest.mark.asyncio
async def test_default_factory_constructs_pinned_tool_without_network(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invocations: list[dict[str, object]] = []

    async def fake_ainvoke(
        tool: TavilySearch,
        payload: dict[str, str],
        *_args: object,
        **_kwargs: object,
    ) -> object:
        invocations.append(
            {
                "payload": payload,
                "search_depth": tool.search_depth,
                "max_results": tool.max_results,
                "api_key": tool.api_wrapper.tavily_api_key.get_secret_value(),
            }
        )
        return {
            "results": [
                {
                    "title": "Pinned constructor",
                    "url": "https://example.org/pinned",
                    "content": "No network request",
                }
            ]
        }

    monkeypatch.setattr(TavilySearch, "ainvoke", fake_ainvoke)
    settings = Settings(
        _env_file=None,
        TAVILY_API_KEY="real-constructor-shape-secret",
        TAVILY_MAX_RESULTS=3,
    )

    result = await TavilySearchGateway(settings=settings).search("constructor check")

    assert result.status == "used"
    assert invocations == [
        {
            "payload": {"query": "constructor check"},
            "search_depth": "basic",
            "max_results": 3,
            "api_key": "real-constructor-shape-secret",
        }
    ]


@pytest.mark.asyncio
async def test_search_keeps_only_five_sanitized_results_and_public_projection() -> None:
    raw_results = [
        {
            "title": f"  Result\t{i}  ",
            "url": f"https://example.org/result/{i}",
            "content": f"  Evidence\n{i}  ",
            "raw_content": "must never escape",
            "score": 0.99,
        }
        for i in range(7)
    ]
    gateway, _ = make_gateway(FakeTool({"results": raw_results}))

    result = await gateway.search("topic")

    assert result.status == "used"
    assert len(result.evidence) == 5
    assert len(result.sources) == 5
    assert asdict(result.evidence[0]) == {
        "title": "Result 0",
        "url": "https://example.org/result/0",
        "snippet": "Evidence 0",
    }
    assert result.sources[0].model_dump(mode="json") == {
        "sourceType": "web",
        "title": "Result 0",
        "reference": "Tavily web search",
        "url": "https://example.org/result/0",
    }
    assert "raw_content" not in result.sources[0].model_dump(mode="json")


@pytest.mark.asyncio
async def test_search_rejects_unsafe_urls_and_blank_titles_and_bounds_text() -> None:
    long_title = "T" * 500
    long_snippet = "S" * 5000
    raw_results = [
        {"title": "HTTP", "url": "http://example.org", "content": "no"},
        {"title": "Credentials", "url": "https://user:pass@example.org", "content": "no"},
        {"title": "Missing host", "url": "https:///path", "content": "no"},
        {"title": "\x00\n\t", "url": "https://example.org/blank", "content": "no"},
        {
            "title": f"\x00 {long_title}\n",
            "url": "https://example.org/safe#fragment",
            "content": f"\x00 {long_snippet}\n",
        },
    ]
    gateway, _ = make_gateway(FakeTool({"results": raw_results}))

    result = await gateway.search("topic")

    assert result.status == "used"
    assert len(result.evidence) == 1
    assert len(result.evidence[0].title) == 200
    assert len(result.evidence[0].snippet) == 1500
    assert "\x00" not in result.evidence[0].title
    assert "\x00" not in result.evidence[0].snippet
    assert result.evidence[0].url == "https://example.org/safe"


@pytest.mark.asyncio
async def test_malformed_url_is_skipped_without_discarding_valid_results() -> None:
    gateway, _ = make_gateway(
        FakeTool(
            {
                "results": [
                    {"title": "Malformed", "url": "https://%zz", "content": "bad"},
                    {
                        "title": "Valid",
                        "url": "https://example.org/valid",
                        "content": "safe",
                    },
                ]
            }
        )
    )

    result = await gateway.search("topic")

    assert result.status == "used"
    assert [item.title for item in result.evidence] == ["Valid"]
    assert [item.title for item in result.sources] == ["Valid"]


@pytest.mark.asyncio
async def test_only_malformed_or_oversized_urls_return_failed_without_raising() -> None:
    oversized_url = f"https://example.org/{'a' * 5000}"
    gateway, _ = make_gateway(
        FakeTool(
            {
                "results": [
                    {"title": "Malformed", "url": "https://%zz", "content": "bad"},
                    {"title": "Oversized", "url": oversized_url, "content": "too large"},
                ]
            }
        )
    )

    result = await gateway.search("topic")

    assert result.status == "failed"
    assert result.evidence == ()
    assert result.sources == ()


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["", "   \n\t  "])
async def test_blank_query_fails_without_constructing_tool(query: str) -> None:
    gateway, constructor_calls = make_gateway(FakeTool({"results": []}))

    result = await gateway.search(query)

    assert result.status == "failed"
    assert result.evidence == ()
    assert result.sources == ()
    assert constructor_calls == []


@pytest.mark.asyncio
async def test_missing_key_fails_without_constructing_tool() -> None:
    gateway, constructor_calls = make_gateway(
        FakeTool({"results": []}), api_key="  "
    )

    result = await gateway.search("topic")

    assert result.status == "failed"
    assert result.evidence == ()
    assert result.sources == ()
    assert constructor_calls == []


@pytest.mark.asyncio
async def test_timeout_is_bounded_and_invokes_tool_once() -> None:
    tool = BlockingTool()
    gateway, _ = make_gateway(tool, timeout=0.01)

    result = await gateway.search("topic")

    assert result.status == "failed"
    assert tool.invocations == [{"query": "topic"}]


class QuotaError(RuntimeError):
    pass


class AuthenticationError(RuntimeError):
    pass


class ToolError(RuntimeError):
    pass


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error_type", [QuotaError, AuthenticationError, ConnectionError, ToolError]
)
async def test_provider_exceptions_fail_without_logging_sensitive_data(
    error_type: Callable[[str], Exception], caplog: pytest.LogCaptureFixture
) -> None:
    query = "private search query"
    secret = "secret-that-must-not-be-logged"
    raw_body = "raw provider response"
    gateway, _ = make_gateway(
        FakeTool(error=error_type(f"{secret} | {query} | {raw_body}")), api_key=secret
    )

    with caplog.at_level(logging.WARNING):
        result = await gateway.search(query)

    assert result.status == "failed"
    assert secret not in caplog.text
    assert query not in caplog.text
    assert raw_body not in caplog.text
    assert error_type.__name__ in caplog.text


@pytest.mark.asyncio
async def test_provider_error_payload_fails_without_logging_response_body(
    caplog: pytest.LogCaptureFixture,
) -> None:
    sensitive_body = "quota error body with private details"
    gateway, _ = make_gateway(FakeTool({"error": sensitive_body}))

    with caplog.at_level(logging.WARNING):
        result = await gateway.search("private topic")

    assert result.status == "failed"
    assert sensitive_body not in caplog.text
    assert "private topic" not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [None, [], "not a mapping", {}, {"results": "not a list"}, {"results": [None]}],
)
async def test_malformed_or_unusable_responses_fail(response: object) -> None:
    gateway, _ = make_gateway(FakeTool(response))

    result = await gateway.search("topic")

    assert result.status == "failed"
    assert result.evidence == ()
    assert result.sources == ()


def test_gateway_has_no_dependency_capable_of_fetching_result_urls() -> None:
    tree = ast.parse(inspect.getsource(tavily_gateway_module))
    forbidden_modules = {"requests", "httpx", "aiohttp", "urllib.request"}
    imported_modules: set[str] = set()
    dynamically_imported_modules: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported_modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            imported_modules.add(node.module)
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "import_module"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            dynamically_imported_modules.add(node.args[0].value)

    all_imports = imported_modules | dynamically_imported_modules
    assert not {
        imported
        for imported in all_imports
        if any(
            imported == forbidden or imported.startswith(f"{forbidden}.")
            for forbidden in forbidden_modules
        )
    }
