"""
分析任务 Repository — 封装 analysis_tasks 表的 CRUD 操作。
所有数据库调用通过此层，不在路由处理器中直接写 SQL。
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.db import execute_query, execute_update, get_connection

logger = logging.getLogger("mood_ai_service")


def create_task(
    user_id: int,
    period: str,
    request_json: Optional[Dict[str, Any]] = None,
) -> str:
    """
    创建分析任务，返回 task_id。
    状态初始为 'pending'。
    """
    task_id = uuid.uuid4().hex
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO analysis_tasks (task_id, user_id, period, status, request_json, created_at)
               VALUES (%s, %s, %s, 'pending', %s, NOW())""",
            (task_id, user_id, period, json.dumps(request_json) if request_json else None),
        )
        conn.commit()
        logger.info("创建分析任务: task_id=%s, user_id=%s, period=%s", task_id, user_id, period)
        return task_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """按 task_id 查询任务"""
    rows = execute_query(
        "SELECT * FROM analysis_tasks WHERE task_id = %s",
        (task_id,),
    )
    return rows[0] if rows else None


def get_tasks_by_user(
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """按用户 ID 查询最近的分析任务"""
    return execute_query(
        "SELECT * FROM analysis_tasks WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (user_id, limit, offset),
    )


def update_task_status(
    task_id: str,
    status: str,
    error_message: Optional[str] = None,
) -> int:
    """更新任务状态 (pending|running|completed|failed)"""
    if error_message:
        return execute_update(
            "UPDATE analysis_tasks SET status = %s, error_message = %s, updated_at = NOW() WHERE task_id = %s",
            (status, error_message, task_id),
        )
    return execute_update(
        "UPDATE analysis_tasks SET status = %s, updated_at = NOW() WHERE task_id = %s",
        (status, task_id),
    )


def update_task_result(
    task_id: str,
    result_json: Dict[str, Any],
    provider: str = "",
    model: str = "",
    prompt_version: str = "",
) -> int:
    """
    更新分析结果 — 事务内完成：
    1. 更新 result_json
    2. 更新 status 为 'completed'
    3. 更新 provider/model 信息
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE analysis_tasks
               SET status = 'completed',
                   result_json = %s,
                   provider = %s,
                   model = %s,
                   prompt_version = %s,
                   updated_at = NOW()
               WHERE task_id = %s""",
            (
                json.dumps(result_json),
                provider,
                model,
                prompt_version,
                task_id,
            ),
        )
        conn.commit()
        logger.info("分析任务完成: task_id=%s, provider=%s, model=%s", task_id, provider, model)
        return cursor.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fail_task(task_id: str, error_message: str) -> int:
    """标记任务失败"""
    return update_task_status(task_id, "failed", error_message=error_message)