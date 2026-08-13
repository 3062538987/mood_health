"""免费 DuckDuckGo 检索兜底网关（无需 API Key）。

当未配置 Tavily Key 时，作为联网检索的降级路径。依赖 duckduckgo_search
（可选；缺失、被限流或解析失败时优雅返回 failed，不影响主流程）。
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import time
from typing import Any

from app.agent.tavily_gateway import (
    MAX_PROVIDER_RESULTS,
    MAX_SNIPPET_LENGTH,
    MAX_TITLE_LENGTH,
    WebSearchEvidence,
    WebSearchResult,
    _normalize_text,
    _sanitize_https_url,
)
from app.config import Settings
from app.models.contracts import RagSource

logger = logging.getLogger(__name__)

SOURCE_REFERENCE = "DuckDuckGo web search"

_DDGS_TEXT_KEYS = ("title", "href", "body")

# 兜底检索结果缓存：避免同一 query 在会话内被重复外呼（降延迟、防限流）。
# 进程级、非持久化；TTL 过期后自动回源。failed 结果不缓存（每次真实探测可用性）。
_DEFAULT_CACHE_TTL_SECONDS = 600.0
_cache: dict[str, tuple[float, WebSearchResult]] = {}
_cache_lock = asyncio.Lock()


def _now() -> float:
    return time.monotonic()


def _cache_get(
    query: str,
    ttl: float = _DEFAULT_CACHE_TTL_SECONDS,
    now: float | None = None,
) -> WebSearchResult | None:
    entry = _cache.get(query)
    if entry is None:
        return None
    cached_at, result = entry
    if (now if now is not None else _now()) - cached_at > ttl:
        _cache.pop(query, None)
        return None
    return result


def _cache_put(query: str, result: WebSearchResult, now: float | None = None) -> None:
    _cache[query] = ((now if now is not None else _now()), result)


class DuckDuckGoSearchGateway:
    def __init__(
        self,
        *,
        settings: Settings,
        cache_ttl_seconds: float = _DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._settings = settings
        self._cache_ttl_seconds = cache_ttl_seconds

    async def search(self, query: str) -> WebSearchResult:
        normalized_query = _normalize_text(query)
        if not normalized_query:
            return WebSearchResult(status="failed")

        # 命中新鲜缓存：直接返回，不再外呼
        cached = _cache_get(normalized_query, self._cache_ttl_seconds)
        if cached is not None:
            logger.debug("DuckDuckGo 命中缓存 query=%r", normalized_query[:60])
            return cached

        try:
            module = importlib.import_module("duckduckgo_search")
            ddgs = module.DDGS()
        except Exception as exc:
            logger.warning("DuckDuckGo 检索不可用（依赖缺失）type=%s", type(exc).__name__)
            return WebSearchResult(status="failed")

        try:
            raw_results = await asyncio.to_thread(
                ddgs.text,
                normalized_query,
                max_results=MAX_PROVIDER_RESULTS,
                region="cn-zh",
                safesearch="moderate",
            )
        except Exception as exc:
            logger.warning("DuckDuckGo 检索失败 type=%s", type(exc).__name__)
            return WebSearchResult(status="failed")

        evidence: list[WebSearchEvidence] = []
        sources: list[RagSource] = []
        for raw in raw_results or []:
            if len(evidence) >= MAX_PROVIDER_RESULTS:
                break
            title = _normalize_text(str(raw.get("title", "")), max_length=MAX_TITLE_LENGTH)
            url = _sanitize_https_url(str(raw.get("href", "")))
            snippet = _normalize_text(str(raw.get("body", "")), max_length=MAX_SNIPPET_LENGTH)
            if not title or url is None:
                continue
            try:
                source = RagSource.model_validate(
                    {
                        "sourceType": "web",
                        "title": title,
                        "reference": SOURCE_REFERENCE,
                        "url": url,
                    }
                )
            except Exception:
                continue
            evidence.append(WebSearchEvidence(title=title, url=url, snippet=snippet))
            sources.append(source)

        if not evidence:
            logger.warning("DuckDuckGo 检索失败：无可用结果")
            return WebSearchResult(status="failed")

        result = WebSearchResult(status="used", evidence=tuple(evidence), sources=tuple(sources))
        # 仅缓存成功结果（failed 每次都真实探测，保证可用性恢复可见）
        _cache_put(normalized_query, result)
        return result


def is_duckduckgo_available() -> bool:
    """运行期探测 duckduckgo_search 是否可导入（用于选择兜底网关）。"""
    try:
        importlib.import_module("duckduckgo_search")
        return True
    except Exception:
        return False


def build_web_gateway(settings: Settings) -> tuple[Any, bool]:
    """按优先级选择联网检索网关：Tavily(有 Key) > DuckDuckGo(可用) > 不可用。

    返回 (网关实例, web_available)。web_available=False 时上层应跳过联网。
    """
    if settings.TAVILY_API_KEY.strip():
        from app.agent.tavily_gateway import TavilySearchGateway

        return TavilySearchGateway(settings=settings), True
    if is_duckduckgo_available():
        return DuckDuckGoSearchGateway(settings=settings), True
    from app.agent.tavily_gateway import TavilySearchGateway

    # 无可用联网：仍返回 Tavily 网关，但它会因缺 Key 而返回 failed
    return TavilySearchGateway(settings=settings), False
