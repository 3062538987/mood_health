"""
FastAPI 配置 — 从环境变量加载，提供类型安全的 settings 单例。
禁止在日志中记录密码、Token、Cookie。
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置 — 所有值从环境变量或 .env 文件读取"""

    # 服务
    MOOD_AI_SERVICE_PORT: int = 8001
    NODE_ENV: str = "development"

    # MySQL（ID 隔离）
    MYSQL_HOST: str = "127.0.0.1"
    MYSQL_PORT: int = 3306
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
    AI_MODEL: str = "deepseek-chat"

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


@lru_cache()
def get_settings() -> Settings:
    return Settings()