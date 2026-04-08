"""
Redis 客户端模块

提供 Redis 连接管理、客户端初始化和连接池功能
"""

from typing import Optional
import redis
from redis.connection import ConnectionPool

from common import settings, get_logger

logger = get_logger(__name__)


class RedisClient:
    """
    Redis 客户端管理类
    
    管理 Redis 连接池和客户端实例，提供单例模式访问
    """
    
    _instance: Optional['RedisClient'] = None
    _client: Optional[redis.Redis] = None
    _pool: Optional[ConnectionPool] = None
    
    def __new__(cls) -> 'RedisClient':
        """单例模式实现"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化（仅第一次创建时执行）"""
        if self._client is not None:
            return
        
        self._initialized = False
        self._connect()
    
    def _connect(self) -> None:
        """
        建立 Redis 连接
        
        使用连接池创建 Redis 客户端，并执行 ping 检查
        """
        try:
            # 创建连接池
            if settings.REDIS_PASSWORD:
                self._pool = ConnectionPool(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    password=settings.REDIS_PASSWORD,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
                    decode_responses=True
                )
            else:
                self._pool = ConnectionPool.from_url(
                    settings.REDIS_URL,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
                    decode_responses=True
                )
            
            # 创建客户端
            self._client = redis.Redis(connection_pool=self._pool)
            
            # 连接检查
            self._client.ping()
            self._initialized = True
            logger.info("Redis 连接成功")
            
        except Exception as e:
            logger.warning(f"Redis 连接失败: {e}")
            self._client = None
            self._pool = None
            self._initialized = False
    
    @property
    def client(self) -> Optional[redis.Redis]:
        """
        获取 Redis 客户端实例
        
        Returns:
            Optional[redis.Redis]: Redis 客户端，连接失败返回 None
        """
        return self._client
    
    @property
    def is_connected(self) -> bool:
        """
        检查连接状态
        
        Returns:
            bool: 是否已连接
        """
        if self._client is None:
            return False
        
        try:
            self._client.ping()
            return True
        except Exception:
            return False
    
    def reconnect(self) -> bool:
        """
        重新连接 Redis
        
        Returns:
            bool: 重连是否成功
        """
        logger.info("尝试重新连接 Redis...")
        self.close()
        self._connect()
        return self.is_connected
    
    def close(self) -> None:
        """关闭 Redis 连接"""
        if self._pool:
            try:
                self._pool.disconnect()
                logger.info("Redis 连接池已关闭")
            except Exception as e:
                logger.warning(f"关闭 Redis 连接池失败: {e}")
        
        self._client = None
        self._pool = None
        self._initialized = False
    
    def health_check(self) -> dict:
        """
        健康检查
        
        Returns:
            dict: 健康状态信息
        """
        status = {
            "connected": self.is_connected,
            "initialized": self._initialized,
        }
        
        if self.is_connected:
            try:
                info = self._client.info()
                status["version"] = info.get("redis_version", "unknown")
                status["used_memory"] = info.get("used_memory_human", "unknown")
                status["connected_clients"] = info.get("connected_clients", 0)
            except Exception as e:
                status["error"] = str(e)
        
        return status


# 全局 Redis 客户端实例
_redis_client_instance: Optional[RedisClient] = None


def get_redis_client() -> Optional[redis.Redis]:
    """
    获取 Redis 客户端
    
    获取全局 Redis 客户端实例，如果未初始化则自动创建
    
    Returns:
        Optional[redis.Redis]: Redis 客户端，连接失败返回 None
        
    Example:
        >>> client = get_redis_client()
        >>> if client:
        ...     client.set("key", "value")
    """
    global _redis_client_instance
    
    if _redis_client_instance is None:
        _redis_client_instance = RedisClient()
    
    return _redis_client_instance.client


def close_redis_connection() -> None:
    """
    关闭 Redis 连接
    
    在应用关闭时调用，释放连接资源
    
    Example:
        >>> close_redis_connection()
    """
    global _redis_client_instance
    
    if _redis_client_instance:
        _redis_client_instance.close()
        _redis_client_instance = None
        logger.info("Redis 连接已关闭")


def check_redis_health() -> dict:
    """
    检查 Redis 健康状态
    
    Returns:
        dict: 健康状态信息
        
    Example:
        >>> health = check_redis_health()
        >>> print(health["connected"])
    """
    global _redis_client_instance
    
    if _redis_client_instance is None:
        _redis_client_instance = RedisClient()
    
    return _redis_client_instance.health_check()


# 便捷访问：直接导出 Redis 客户端实例
redis_client = get_redis_client()
