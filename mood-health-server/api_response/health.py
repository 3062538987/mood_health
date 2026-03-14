"""
健康检查模块

提供系统健康检查服务和路由
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, status

from common import get_logger, settings
from db import redis_client

from .responses import HealthStatus, create_health_response

logger = get_logger(__name__)

# 创建健康检查路由
health_router = APIRouter(tags=["系统"])


async def check_redis_health() -> Dict[str, Any]:
    """
    检查 Redis 健康状态
    
    Returns:
        Dict: Redis 健康状态信息
    """
    try:
        is_connected = redis_client.is_connected()
        return {
            "status": "healthy" if is_connected else "unhealthy",
            "connected": is_connected
        }
    except Exception as e:
        logger.error(f"Redis 健康检查失败: {e}")
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e)
        }


async def system_health_check() -> Dict[str, Any]:
    """
    系统健康检查
    
    检查所有关键组件的健康状态
    
    Returns:
        Dict: 统一格式的健康检查响应
    """
    # 检查 Redis
    redis_health = await check_redis_health()
    redis_connected = redis_health.get("connected", False)
    
    # 确定整体状态
    if redis_connected:
        overall_status = "healthy"
    else:
        overall_status = "degraded"
    
    # 构建组件状态
    components = {
        "redis": redis_health
    }
    
    logger.debug(f"健康检查完成: status={overall_status}")
    
    return create_health_response(
        status=overall_status,
        redis_connected=redis_connected,
        version=settings.APP_VERSION,
        environment=settings.ENV,
        components=components
    )


@health_router.get(
    "/health",
    response_model=HealthStatus,
    summary="系统健康检查",
    description="检查系统各组件的健康状态",
    response_description="系统健康状态信息"
)
async def health_endpoint():
    """
    健康检查端点
    
    返回系统整体健康状态和各组件状态
    """
    return await system_health_check()


@health_router.get(
    "/ready",
    summary="就绪检查",
    description="检查服务是否已就绪可以接收流量"
)
async def readiness_check():
    """
    就绪检查端点
    
    用于 Kubernetes 等容器编排平台的就绪探针
    """
    health = await system_health_check()
    
    if health.get("status") == "healthy":
        return health
    
    return health


@health_router.get(
    "/live",
    summary="存活检查",
    description="检查服务是否存活"
)
async def liveness_check():
    """
    存活检查端点
    
    用于 Kubernetes 等容器编排平台的存活探针
    """
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat()
    }


def register_health_routes(app: Any, prefix: str = "") -> None:
    """
    注册健康检查路由
    
    Args:
        app: FastAPI 应用实例
        prefix: 路由前缀
    """
    app.include_router(health_router, prefix=prefix)
    logger.debug(f"健康检查路由已注册: {prefix or '/'}")
