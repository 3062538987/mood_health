"""
FastAPI 应用入口 — 情绪分析微服务。
提供健康检查、就绪探测、情绪分析端点。
"""

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.analyze import router as analyze_router

logger = logging.getLogger("mood_ai_service")

# ---- 连接池（延迟初始化，在 lifespan 中设置） ----
_mysql_pool = None
_redis_client = None


def get_mysql_pool():
    return _mysql_pool


def get_redis_client():
    return _redis_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期：启动时连接 MySQL/Redis，关闭时释放连接"""
    global _mysql_pool, _redis_client
    settings = get_settings()
    startup_ok = True

    # MySQL
    try:
        import mysql.connector.pooling

        _mysql_pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="mood_ai_pool",
            pool_size=5,
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            charset="utf8mb4",
        )
        logger.info("MySQL 连接池已创建 (host=%s, db=%s)", settings.MYSQL_HOST, settings.MYSQL_DATABASE)
    except Exception as e:
        logger.warning("MySQL 连接池创建失败: %s", e)
        startup_ok = False

    # Redis
    try:
        import redis.asyncio as aioredis

        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        await _redis_client.ping()
        logger.info("Redis 已连接 (host=%s)", settings.REDIS_HOST)
    except Exception as e:
        logger.warning("Redis 连接失败: %s", e)
        _redis_client = None

    logger.info("FastAPI 启动完成 (dev_mode=%s)", settings.dev_mode)
    yield

    # 关闭
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis 已关闭")
    if _mysql_pool:
        logger.info("MySQL 连接池已释放")


app = FastAPI(
    title="Mood Health AI Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs" if os.environ.get("NODE_ENV", "development") == "development" else None,
    redoc_url=None,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """请求日志 — 不记录 Cookie/Token/密码"""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


app.include_router(analyze_router)


@app.get("/api/health")
async def health():
    """健康检查 — 轻量，不依赖外部服务"""
    return {"status": "ok", "service": "mood_health_ai_service", "version": "0.1.0"}


@app.get("/api/health/ready")
async def readiness():
    """就绪探测 — 验证 MySQL 和 Redis 可用"""
    checks = {"mysql": False, "redis": False}
    failures = []

    if _mysql_pool:
        try:
            conn = _mysql_pool.get_connection()
            conn.close()
            checks["mysql"] = True
        except Exception as e:
            failures.append(f"mysql: {e}")
    else:
        failures.append("mysql: pool not initialized")

    if _redis_client:
        try:
            await _redis_client.ping()
            checks["redis"] = True
        except Exception as e:
            failures.append(f"redis: {e}")
    else:
        failures.append("redis: client not initialized")

    healthy = all(checks.values())
    status_code = 200 if healthy else 503

    return JSONResponse(
        content={
            "status": "ready" if healthy else "not_ready",
            "checks": checks,
            "failures": failures,
        },
        status_code=status_code,
    )