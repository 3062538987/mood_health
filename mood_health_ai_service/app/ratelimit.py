"""
轻量固定窗口限流（进程内，无外部依赖）。

用于保护 AI 端点免受滥用 / 突发流量。单进程部署足够；
多 worker / 多实例部署应替换为 Redis 等共享计数器（TODO: P1）。
"""

import time
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request

_DEFAULT_LIMIT = 20  # 每个窗口允许的请求数
_DEFAULT_WINDOW = 60  # 窗口长度（秒）

_state: dict[str, list[float]] = {}


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(
    limit: int = _DEFAULT_LIMIT, window: int = _DEFAULT_WINDOW
) -> Callable[[Request], Awaitable[None]]:
    """返回一个 FastAPI 依赖，对「客户端 IP + 路径」做固定窗口限流。"""

    async def dependency(request: Request) -> None:
        key = f"{_client_key(request)}:{request.url.path}"
        now = time.time()
        bucket = _state.setdefault(key, [])
        cutoff = now - window
        # 丢弃窗口外的记录
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=429,
                detail="请求过于频繁，请稍后再试",
                headers={"Retry-After": str(window)},
            )
        bucket.append(now)

    return dependency
