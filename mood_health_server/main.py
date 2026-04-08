"""
统一入口模块

FastAPI 应用主入口，仅负责装配各模块
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from api_response import register_health_routes, setup_exception_handlers
from assessment import register_legacy_routes, router as assessment_router
from common import get_logger, settings
from db import check_redis_health, close_redis_connection
from treehole.router import router as treehole_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    处理应用启动和关闭时的资源管理
    """
    # 启动
    logger.info("=" * 50)
    logger.info("应用启动中...")
    logger.info(f"环境: {settings.ENV}")
    logger.info(f"调试模式: {settings.DEBUG}")
    
    # 检查 Redis 连接
    if check_redis_health().get("connected", False):
        logger.info("Redis 连接正常")
    else:
        logger.warning("Redis 未连接，缓存功能将不可用")
    
    logger.info("应用启动完成")
    logger.info("=" * 50)
    
    yield
    
    # 关闭
    logger.info("应用关闭中...")
    close_redis_connection()
    logger.info("应用关闭完成")


def create_app() -> FastAPI:
    """
    创建 FastAPI 应用实例
    
    装配所有组件：中间件、限流器、异常处理器、路由
    
    Returns:
        FastAPI: 配置完成的应用实例
    """
    # 创建应用实例
    app = FastAPI(
        title=settings.APP_NAME,
        description="大学生情绪健康平台 API 服务",
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )
    
    # ==================== 中间件 ====================
    
    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.debug("CORS 中间件已注册")
    
    # ==================== 限流器 ====================
    
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["100/minute"]
    )
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    logger.debug("限流器已注册")
    
    # ==================== 异常处理器 ====================
    
    setup_exception_handlers(app)
    logger.debug("全局异常处理器已注册")
    
    # ==================== 路由 ====================
    
    # 挂载 assessment 路由
    app.include_router(
        assessment_router,
        prefix="/api/v1",
        tags=["心理测评"]
    )
    logger.debug("Assessment 路由已挂载: /api/v1")
    
    # 注册向后兼容的路由
    register_legacy_routes(app)
    logger.debug("向后兼容路由已注册")

    # 挂载 treehole 路由
    app.include_router(
        treehole_router,
        prefix="",
        tags=["树洞AI"]
    )
    logger.debug("TreeHole 路由已挂载: /treehole")
    
    # 注册健康检查路由
    register_health_routes(app)
    logger.debug("健康检查路由已注册")
    
    # 根路由
    @app.get("/", tags=["系统"])
    async def root():
        """服务根路径"""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs" if settings.DEBUG else None,
            "health": "/health"
        }
    
    logger.info("所有组件装配完成")
    return app


# 创建应用实例
app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug"
    )
