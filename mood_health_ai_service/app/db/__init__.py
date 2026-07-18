"""
数据库连接辅助 — 从 lifespan 注入的连接池获取连接。
不持有独立连接池，仅封装查询接口。
"""

import logging
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

logger = logging.getLogger("mood_ai_service")


def get_connection():
    """获取 MySQL 连接（从 lifespan 注入的连接池）"""
    from app.main import get_mysql_pool

    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("MySQL 连接池未初始化")
    return pool.get_connection()


def execute_query(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """执行查询，返回字典列表"""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params)
        return cursor.fetchall()
    finally:
        conn.close()


def execute_update(sql: str, params: tuple = ()) -> int:
    """执行更新，返回影响行数"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()