import os
from dotenv import load_dotenv
from functools import lru_cache

# 加载 .env 文件（优先从 agent_app 目录）
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH)
else:
    load_dotenv()


class Config:
    """应用配置单例 — 所有敏感信息从环境变量读取，严禁硬编码"""

    @property
    def AI_API_KEY(self) -> str:
        return os.getenv("AI_API_KEY", "")

    @property
    def AI_BASE_URL(self) -> str:
        return os.getenv("AI_BASE_URL", "https://api.deepseek.com/v1")

    @property
    def AI_MODEL(self) -> str:
        return os.getenv("AI_MODEL", "deepseek-chat")

    @property
    def MYSQL_HOST(self) -> str:
        return os.getenv("MYSQL_HOST", "127.0.0.1")

    @property
    def MYSQL_PORT(self) -> int:
        return int(os.getenv("MYSQL_PORT", "3306"))

    @property
    def MYSQL_USER(self) -> str:
        return os.getenv("MYSQL_USER", "root")

    @property
    def MYSQL_PASSWORD(self) -> str:
        return os.getenv("MYSQL_PASSWORD", "")

    @property
    def MYSQL_DATABASE(self) -> str:
        return os.getenv("MYSQL_DATABASE", "mood_health")

    # Agent 配置常量
    MAX_ITERATIONS: int = 10
    MAX_HISTORY_ROUNDS: int = 10
    SUMMARY_TRIGGER_ROUNDS: int = 10
    KEEP_RECENT_ROUNDS: int = 5

    def validate(self) -> bool:
        """验证必要配置"""
        if not self.AI_API_KEY:
            raise ValueError("AI_API_KEY 未配置，请在 agent_app/.env 中设置")
        return True


@lru_cache()
def get_config() -> Config:
    """获取配置单例"""
    config = Config()
    config.validate()
    return config