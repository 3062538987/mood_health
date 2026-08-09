"""
FastAPI 配置 — 从环境变量加载，提供类型安全的 settings 单例。
禁止在日志中记录密码、Token、Cookie。
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置 — 所有值从环境变量或 .env 文件读取"""

    # 服务
    MOOD_AI_SERVICE_PORT: int = 8001
    NODE_ENV: str = "development"

    # MySQL（ID 隔离）
    MYSQL_HOST: str = "127.0.0.1"
    MYSQL_PORT: int = 3316  # 与运行实例/根 .env 一致（默认不再是 3306，避免漂移连错端口）
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "mood_health"

    # Redis（ID 隔离）
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # AI Provider
    AI_API_KEY: str = ""
    AI_BASE_URL: str = "https://api.deepseek.com/v1"
    AI_MODEL: str = "deepseek-v4-flash"

    # Optional web search provider. Search behavior remains fixed in the gateway.
    TAVILY_API_KEY: str = ""
    TAVILY_TIMEOUT_SECONDS: float = Field(default=10.0, gt=0, le=30)
    TAVILY_MAX_RESULTS: int = Field(default=5, ge=1, le=5)

    # RAG retrieval
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-small-zh-v1.5"
    RAG_COLLECTION_NAME: str = "mental_health_knowledge_bge_zh_v1"
    RAG_PERSIST_DIRECTORY: str = "./data/chroma"
    RAG_TOP_K: int = 3
    RAG_MIN_SIMILARITY: float = 0.60

    # 内部服务认证
    AI_SERVICE_INTERNAL_TOKEN: str = ""

    # 日志
    LOG_LEVEL: str = "INFO"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def dev_mode(self) -> bool:
        return self.NODE_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_required_settings(settings: "Settings | None" = None) -> None:
    """
    启动必填配置校验（fail-closed）。

    缺失必填项时抛出 RuntimeError，使服务在启动阶段即拒绝运行，
    避免「空令牌导致内部接口裸奔」的隐患（两端共用空 token 时 HMAC 形同虚设）。

    测试环境（pytest）与显式跳过标志下不校验，以免破坏单测收集。
    """
    import os
    import sys

    if os.environ.get("NODE_ENV") == "test" or "pytest" in sys.modules:
        return

    if os.environ.get("AI_SERVICE_SKIP_CONFIG_VALIDATION") == "1":
        return

    s = settings or get_settings()
    missing: list[str] = []
    if not s.AI_SERVICE_INTERNAL_TOKEN:
        missing.append("AI_SERVICE_INTERNAL_TOKEN")
    if missing:
        raise RuntimeError(
            "缺少必填配置，AI 服务拒绝启动: " + ", ".join(missing)
        )
