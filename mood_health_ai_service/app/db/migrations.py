"""
数据库迁移 — 在 lifespan 启动时自动运行。
幂等迁移，使用 CREATE TABLE IF NOT EXISTS。
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger("mood_ai_service")

MIGRATIONS_DIR = Path(__file__).parent.parent.parent / "migrations"


def run_migrations() -> None:
    """
    按文件名排序执行所有 .sql 迁移文件。
    迁移必须是幂等的（使用 IF NOT EXISTS）。
    """
    if not MIGRATIONS_DIR.exists():
        logger.warning("迁移目录不存在: %s", MIGRATIONS_DIR)
        return

    from app.db import get_connection

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        logger.info("无迁移文件待执行")
        return

    conn = get_connection()
    try:
        cursor = conn.cursor()
        for sql_file in sql_files:
            logger.info("执行迁移: %s", sql_file.name)
            sql = sql_file.read_text(encoding="utf-8")
            # 按分号分割执行多条语句
            for statement in sql.split(";"):
                statement = statement.strip()
                if statement:
                    cursor.execute(statement)
        conn.commit()
        logger.info("迁移完成: 共 %d 个文件", len(sql_files))
    except Exception as e:
        conn.rollback()
        logger.error("迁移失败: %s", e)
        raise
    finally:
        conn.close()