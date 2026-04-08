"""
数据库操作模块

提供Redis连接、缓存工具等数据库相关功能
"""

from .redis_client import (
    RedisClient,
    check_redis_health,
    close_redis_connection,
    get_redis_client,
    redis_client,
)
from .cache_utils import (
    CacheManager,
    build_cache_key,
    cache_result,
    generate_cache_key,
    invalidate_cache,
)

__all__ = [
    # Redis Client
    "RedisClient",
    "get_redis_client",
    "close_redis_connection",
    "check_redis_health",
    "redis_client",
    # Cache Utils
    "CacheManager",
    "build_cache_key",
    "generate_cache_key",
    "cache_result",
    "invalidate_cache",
]
