"""
跨会话记忆 — MySQL 对话历史存储。
自动建表 agent_conversations，按 user_id 隔离对话记录。
"""

import mysql.connector
from utils.config import get_config
from utils.logger import get_logger

logger = get_logger(__name__)


def _get_connection():
    """获取 MySQL 数据库连接"""
    config = get_config()
    return mysql.connector.connect(
        host=config.MYSQL_HOST,
        port=config.MYSQL_PORT,
        user=config.MYSQL_USER,
        password=config.MYSQL_PASSWORD,
        database=config.MYSQL_DATABASE,
        charset="utf8mb4",
    )


def _ensure_table():
    """确保 agent_conversations 表存在，不存在则自动创建"""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_conversations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            role VARCHAR(20) NOT NULL COMMENT 'user 或 assistant',
            content TEXT NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Agent 对话历史记录'
    """)
    conn.commit()
    cursor.close()
    conn.close()
    logger.info("agent_conversations 表已就绪")


def save_message(user_id: int, role: str, content: str) -> None:
    """
    保存一条对话消息到数据库。

    Args:
        user_id: 用户 ID
        role: 消息角色，'user' 或 'assistant'
        content: 消息内容
    """
    _ensure_table()
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO agent_conversations (user_id, role, content) VALUES (%s, %s, %s)",
        (user_id, role, content),
    )
    conn.commit()
    cursor.close()
    conn.close()


def load_history(user_id: int, limit: int = 50) -> list[dict]:
    """
    加载指定用户的对话历史。

    Args:
        user_id: 用户 ID
        limit: 最大返回条数，默认 50

    Returns:
        对话记录列表，每条包含 role 和 content 字段
    """
    _ensure_table()
    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT role, content FROM agent_conversations "
        "WHERE user_id = %s ORDER BY id ASC LIMIT %s",
        (user_id, limit),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def clear_history(user_id: int) -> None:
    """
    清空指定用户的对话历史。

    Args:
        user_id: 用户 ID
    """
    _ensure_table()
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM agent_conversations WHERE user_id = %s",
        (user_id,),
    )
    conn.commit()
    cursor.close()
    conn.close()
    logger.info("已清空用户 %s 的对话历史", user_id)