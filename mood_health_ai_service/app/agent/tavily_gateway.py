"""Bounded Tavily search gateway for later LangGraph nodes."""

from __future__ import annotations

import asyncio
import importlib
import logging
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Literal, Protocol, cast
from urllib.parse import urlsplit, urlunsplit

from pydantic import SecretStr, ValidationError

from app.config import Settings
from app.models.contracts import RagSource

logger = logging.getLogger(__name__)

MAX_TITLE_LENGTH = 200
MAX_SNIPPET_LENGTH = 1500
MAX_URL_LENGTH = 2048
MAX_PROVIDER_RESULTS = 5
SOURCE_REFERENCE = "Tavily web search"

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f-\x9f]+")


class AsyncSearchTool(Protocol):
    async def ainvoke(self, payload: dict[str, str]) -> object: ...


ToolFactory = Callable[..., AsyncSearchTool]


@dataclass(frozen=True, slots=True)
class WebSearchEvidence:
    title: str
    url: str
    snippet: str


@dataclass(frozen=True, slots=True)
class WebSearchResult:
    status: Literal["used", "failed"]
    evidence: tuple[WebSearchEvidence, ...] = ()
    sources: tuple[RagSource, ...] = ()


class TavilySearchGateway:
    def __init__(self, *, settings: Settings, tool_factory: ToolFactory | None = None) -> None:
        self._settings = settings
        self._tool_factory = tool_factory or _default_tool_factory

    async def search(self, query: str) -> WebSearchResult:
        normalized_query = _normalize_text(query)
        api_key = self._settings.TAVILY_API_KEY.strip()
        if not normalized_query or not api_key:
            return WebSearchResult(status="failed")

        result_limit = min(self._settings.TAVILY_MAX_RESULTS, MAX_PROVIDER_RESULTS)
        try:
            api_wrapper = _build_api_wrapper(api_key)
            tool = self._tool_factory(
                api_wrapper=api_wrapper,
                search_depth="basic",
                max_results=result_limit,
                include_answer=False,
                include_raw_content=False,
                include_images=False,
                include_image_descriptions=False,
                include_favicon=False,
                include_usage=False,
                auto_parameters=False,
                topic="general",
            )
            raw_response = await asyncio.wait_for(
                tool.ainvoke({"query": normalized_query}),
                timeout=self._settings.TAVILY_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            logger.warning("Tavily web search failed: timeout")
            return WebSearchResult(status="failed")
        except Exception as exc:
            logger.warning("Tavily web search failed: %s", type(exc).__name__)
            return WebSearchResult(status="failed")

        return _project_response(raw_response, result_limit)


def _project_response(raw_response: object, result_limit: int) -> WebSearchResult:
    if not isinstance(raw_response, Mapping):
        logger.warning("Tavily web search failed: malformed_response")
        return WebSearchResult(status="failed")
    if "error" in raw_response:
        logger.warning("Tavily web search failed: provider_error")
        return WebSearchResult(status="failed")

    raw_results = raw_response.get("results")
    if not isinstance(raw_results, list):
        logger.warning("Tavily web search failed: malformed_response")
        return WebSearchResult(status="failed")

    evidence: list[WebSearchEvidence] = []
    sources: list[RagSource] = []
    for raw_result in raw_results:
        if len(evidence) >= min(result_limit, MAX_PROVIDER_RESULTS):
            break
        sanitized = _sanitize_result(raw_result)
        if sanitized is None:
            continue
        try:
            source = RagSource.model_validate(
                {
                    "sourceType": "web",
                    "title": sanitized.title,
                    "reference": SOURCE_REFERENCE,
                    "url": sanitized.url,
                }
            )
        except ValidationError:
            continue
        evidence.append(sanitized)
        sources.append(source)

    if not evidence:
        logger.warning("Tavily web search failed: no_usable_results")
        return WebSearchResult(status="failed")

    return WebSearchResult(status="used", evidence=tuple(evidence), sources=tuple(sources))


def _sanitize_result(raw_result: object) -> WebSearchEvidence | None:
    if not isinstance(raw_result, Mapping):
        return None

    raw_title = raw_result.get("title")
    raw_url = raw_result.get("url")
    raw_snippet = raw_result.get("content", raw_result.get("snippet", ""))
    if not isinstance(raw_title, str) or not isinstance(raw_url, str):
        return None

    title = _normalize_text(raw_title, max_length=MAX_TITLE_LENGTH)
    url = _sanitize_https_url(raw_url)
    snippet = (
        _normalize_text(raw_snippet, max_length=MAX_SNIPPET_LENGTH)
        if isinstance(raw_snippet, str)
        else ""
    )
    if not title or url is None:
        return None
    return WebSearchEvidence(title=title, url=url, snippet=snippet)


def _normalize_text(value: str, *, max_length: int | None = None) -> str:
    without_controls = _CONTROL_CHARACTERS.sub(" ", value)
    normalized = " ".join(without_controls.split())
    if max_length is not None:
        return normalized[:max_length].rstrip()
    return normalized


def _sanitize_https_url(value: str) -> str | None:
    candidate = value.strip()
    if (
        not candidate
        or len(candidate) > MAX_URL_LENGTH
        or any(character.isspace() for character in candidate)
    ):
        return None
    if _CONTROL_CHARACTERS.search(candidate):
        return None

    try:
        parsed = urlsplit(candidate)
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            return None
        if parsed.username is not None or parsed.password is not None:
            return None
        _ = parsed.port
    except ValueError:
        return None

    return urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))


def _default_tool_factory(**options: object) -> AsyncSearchTool:
    """Load the optional provider only when a configured search is executed."""
    module = importlib.import_module("langchain_tavily")
    factory = cast(ToolFactory, module.TavilySearch)
    return factory(**options)


def _build_api_wrapper(api_key: str) -> object:
    """Build the pinned wrapper without its SecretStr double-masking bug."""
    module = importlib.import_module("langchain_tavily._utilities")
    wrapper_type = module.TavilySearchAPIWrapper
    # langchain-tavily 0.2.18 stringifies an incoming SecretStr in its
    # pre-validator, which would replace the real value with asterisks.
    # Fields are controlled here, so construct the explicit wrapper directly.
    return cast(
        object,
        wrapper_type.model_construct(tavily_api_key=SecretStr(api_key)),
    )
