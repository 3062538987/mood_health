"""验证 DuckDuckGo 兜底网关的结果缓存：避免同一 query 重复外呼。

不依赖真实的 duckduckgo_search 包：通过 patch 网关模块里的全局名 `importlib` 注入假模块。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from app.agent.duckduckgo_gateway import DuckDuckGoSearchGateway, _cache


class _CallCounter:
    def __init__(self) -> None:
        self.n = 0


class _FakeDDGS:
    def __init__(self, counter: _CallCounter, results: list[dict[str, str]]) -> None:
        self._counter = counter
        self._results = results

    def text(self, query: str, **kwargs: Any) -> list[dict[str, str]]:
        self._counter.n += 1
        return self._results


class _FakeSettings:
    TAVILY_API_KEY = ""


_OK_RESULTS = [
    {"title": "结果一", "href": "https://example.com/a", "body": "这是第一条结果的摘要内容"},
    {"title": "结果二", "href": "https://example.com/b", "body": "这是第二条结果的摘要内容"},
]


def _make_gateway(
    counter: _CallCounter,
    results: list[dict[str, str]] = _OK_RESULTS,
    cache_ttl_seconds: float = 600.0,
) -> DuckDuckGoSearchGateway:
    fake_module = SimpleNamespace(DDGS=lambda: _FakeDDGS(counter, results))
    with patch("app.agent.duckduckgo_gateway.importlib") as mock_importlib:
        mock_importlib.import_module.return_value = fake_module
        return DuckDuckGoSearchGateway(
            settings=_FakeSettings(), cache_ttl_seconds=cache_ttl_seconds
        )


def _search(
    gw: DuckDuckGoSearchGateway,
    counter: _CallCounter,
    query: str,
    results: list[dict[str, str]] = _OK_RESULTS,
) -> Any:
    fake_module = SimpleNamespace(DDGS=lambda: _FakeDDGS(counter, results))
    with patch("app.agent.duckduckgo_gateway.importlib") as mock_importlib:
        mock_importlib.import_module.return_value = fake_module
        return asyncio.run(gw.search(query))


def test_cache_hit_avoids_second_network_call():
    _cache.clear()
    counter = _CallCounter()
    gw = _make_gateway(counter)
    first = _search(gw, counter, "最近总是睡不好，有点焦虑怎么办")
    second = _search(gw, counter, "最近总是睡不好，有点焦虑怎么办")

    assert first.status == "used"
    assert second.status == "used"
    # 第二次命中缓存，DDGS.text 只被调用一次
    assert counter.n == 1


def test_different_query_hits_network_again():
    _cache.clear()
    counter = _CallCounter()
    gw = _make_gateway(counter)
    _search(gw, counter, "最近总是睡不好，有点焦虑怎么办")
    _search(gw, counter, "如何缓解考试前的紧张情绪")

    # 不同 query -> 各自外呼一次
    assert counter.n == 2


def test_cache_expires_after_ttl():
    _cache.clear()
    # 注入可控时钟：第二次调用时把"当前时间"推到 TTL 之后，确保缓存过期
    counter = _CallCounter()
    gw = _make_gateway(counter, cache_ttl_seconds=0.05)
    clock = {"t": 1000.0}
    with patch("app.agent.duckduckgo_gateway._now", side_effect=lambda: clock["t"]):
        _search(gw, counter, "最近总是睡不好，有点焦虑怎么办")
        clock["t"] = 2000.0  # 远超 TTL(0.05s)
        _search(gw, counter, "最近总是睡不好，有点焦虑怎么办")

    # 已过期 -> 再次外呼
    assert counter.n == 2


def test_failed_result_not_cached():
    _cache.clear()
    # 第一次：返回空结果 -> failed（不缓存）
    counter1 = _CallCounter()
    gw1 = _make_gateway(counter1, results=[])
    failed = _search(gw1, counter1, "必定失败的无结果查询", results=[])
    assert failed.status == "failed"
    assert counter1.n == 1

    # 第二次用正常结果：failed 未进缓存，应再次真实外呼并成功
    counter2 = _CallCounter()
    gw2 = _make_gateway(counter2)
    ok = _search(gw2, counter2, "必定失败的无结果查询")
    assert ok.status == "used"
    assert counter2.n == 1
