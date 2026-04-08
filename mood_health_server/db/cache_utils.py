"""
缓存工具模块

提供缓存读写、缓存键构建、缓存装饰器等工具函数
"""

import functools
import hashlib
import json
from typing import Any, Callable, Optional, TypeVar, Union

from common import settings, get_logger
from .redis_client import get_redis_client

logger = get_logger(__name__)

T = TypeVar('T')


def build_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    构建缓存键
    
    基于前缀和参数生成唯一的缓存键
    
    Args:
        prefix: 键前缀，用于命名空间隔离
        *args: 位置参数
        **kwargs: 关键字参数
        
    Returns:
        str: 缓存键
        
    Example:
        >>> key = build_cache_key("mood", "user123", date="2024-01-01")
        >>> print(key)
        "mood:user123:date=2024-01-01"
    """
    parts = [prefix]
    
    # 添加位置参数
    for arg in args:
        if isinstance(arg, (dict, list)):
            parts.append(hashlib.md5(
                json.dumps(arg, sort_keys=True).encode()
            ).hexdigest()[:8])
        else:
            parts.append(str(arg))
    
    # 添加关键字参数
    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        kw_str = ":".join(f"{k}={v}" for k, v in sorted_kwargs)
        parts.append(kw_str)
    
    return ":".join(parts)


def generate_cache_key(prefix: str, identifier: str, *args, **kwargs) -> str:
    """
    生成缓存键（别名函数）
    
    与 build_cache_key 功能相同，提供另一种调用方式
    
    Args:
        prefix: 键前缀
        identifier: 主要标识符
        *args: 其他位置参数
        **kwargs: 关键字参数
        
    Returns:
        str: 缓存键
    """
    return build_cache_key(prefix, identifier, *args, **kwargs)


class CacheManager:
    """
    缓存管理器
    
    提供高层次的缓存操作接口
    """
    
    def __init__(self, default_ttl: Optional[int] = None, key_prefix: str = ""):
        """
        初始化缓存管理器
        
        Args:
            default_ttl: 默认过期时间（秒）
            key_prefix: 键前缀
        """
        self.default_ttl = default_ttl or settings.CACHE_DEFAULT_TTL
        self.key_prefix = key_prefix or settings.CACHE_KEY_PREFIX
        self._client = None
    
    @property
    def client(self):
        """获取 Redis 客户端"""
        if self._client is None:
            self._client = get_redis_client()
        return self._client
    
    def _make_key(self, key: str) -> str:
        """构建完整键名"""
        if self.key_prefix:
            return f"{self.key_prefix}{key}"
        return key
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        获取缓存值
        
        Args:
            key: 缓存键
            default: 默认值
            
        Returns:
            Any: 缓存值或默认值
        """
        if not self.client:
            return default
        
        try:
            full_key = self._make_key(key)
            value = self.client.get(full_key)
            
            if value is None:
                return default
            
            # 尝试解析JSON
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
                
        except Exception as e:
            logger.warning(f"缓存读取失败: {e}")
            return default
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        nx: bool = False
    ) -> bool:
        """
        设置缓存值
        
        Args:
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒），默认使用配置值
            nx: 仅在键不存在时设置
            
        Returns:
            bool: 是否设置成功
        """
        if not self.client:
            return False
        
        try:
            full_key = self._make_key(key)
            ttl = ttl or self.default_ttl
            
            # 序列化值
            if isinstance(value, (dict, list)):
                serialized = json.dumps(value, ensure_ascii=False)
            else:
                serialized = str(value)
            
            if nx:
                return self.client.setnx(full_key, serialized)
            else:
                return self.client.setex(full_key, ttl, serialized)
                
        except Exception as e:
            logger.warning(f"缓存写入失败: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        删除缓存
        
        Args:
            key: 缓存键
            
        Returns:
            bool: 是否删除成功
        """
        if not self.client:
            return False
        
        try:
            full_key = self._make_key(key)
            return bool(self.client.delete(full_key))
        except Exception as e:
            logger.warning(f"缓存删除失败: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """
        检查缓存是否存在
        
        Args:
            key: 缓存键
            
        Returns:
            bool: 是否存在
        """
        if not self.client:
            return False
        
        try:
            full_key = self._make_key(key)
            return bool(self.client.exists(full_key))
        except Exception as e:
            logger.warning(f"缓存检查失败: {e}")
            return False
    
    def ttl(self, key: str) -> int:
        """
        获取缓存剩余时间
        
        Args:
            key: 缓存键
            
        Returns:
            int: 剩余秒数，-1表示永不过期，-2表示不存在
        """
        if not self.client:
            return -2
        
        try:
            full_key = self._make_key(key)
            return self.client.ttl(full_key)
        except Exception as e:
            logger.warning(f"获取TTL失败: {e}")
            return -2
    
    def clear_pattern(self, pattern: str) -> int:
        """
        按模式清除缓存
        
        Args:
            pattern: 匹配模式，如 "user:*"
            
        Returns:
            int: 删除的键数量
        """
        if not self.client:
            return 0
        
        try:
            full_pattern = self._make_key(pattern)
            keys = self.client.keys(full_pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"批量清除缓存失败: {e}")
            return 0


def cache_result(
    key_prefix: str = "",
    ttl: Optional[int] = None,
    key_builder: Optional[Callable] = None
):
    """
    缓存装饰器
    
    自动缓存函数返回结果
    
    Args:
        key_prefix: 缓存键前缀
        ttl: 过期时间（秒）
        key_builder: 自定义键构建函数
        
    Returns:
        Callable: 装饰器
        
    Example:
        >>> @cache_result(key_prefix="mood_analysis", ttl=3600)
        ... def analyze_mood(content: str, level: int):
        ...     # 耗时操作
        ...     return result
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # 检查缓存是否启用
            if not settings.CACHE_ENABLED:
                return func(*args, **kwargs)
            
            # 构建缓存键
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # 默认使用函数名和参数构建键
                key_parts = [key_prefix or func.__name__]
                for arg in args[1:] if args else args:  # 跳过self/cls
                    key_parts.append(str(arg))
                for k, v in sorted(kwargs.items()):
                    key_parts.append(f"{k}={v}")
                cache_key = ":".join(key_parts)
            
            # 尝试读取缓存
            cache = CacheManager()
            cached = cache.get(cache_key)
            if cached is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached
            
            # 执行函数
            result = func(*args, **kwargs)
            
            # 写入缓存
            cache.set(cache_key, result, ttl=ttl)
            logger.debug(f"缓存写入: {cache_key}")
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(key_pattern: str):
    """
    缓存失效装饰器
    
    在函数执行后清除匹配的缓存
    
    Args:
        key_pattern: 要清除的缓存键模式
        
    Returns:
        Callable: 装饰器
        
    Example:
        >>> @invalidate_cache("mood_analysis:*")
        ... def update_mood_data(user_id: str):
        ...     # 更新操作
        ...     pass
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            result = func(*args, **kwargs)
            
            # 清除缓存
            cache = CacheManager()
            count = cache.clear_pattern(key_pattern)
            logger.debug(f"清除缓存: {key_pattern}, 数量: {count}")
            
            return result
        
        return wrapper
    return decorator


# 便捷函数：快速缓存操作
def cache_get(key: str, default: Any = None) -> Any:
    """快速获取缓存"""
    return CacheManager().get(key, default)


def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """快速设置缓存"""
    return CacheManager().set(key, value, ttl)


def cache_delete(key: str) -> bool:
    """快速删除缓存"""
    return CacheManager().delete(key)
