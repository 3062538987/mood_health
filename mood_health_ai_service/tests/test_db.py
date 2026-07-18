"""
数据库模块和迁移测试 — 验证 SQL 语法和迁移脚本结构。
不依赖真实 MySQL 连接。
"""

import os
from pathlib import Path

import pytest

from app.db.migrations import MIGRATIONS_DIR, run_migrations


class TestMigrationScripts:
    def test_migration_files_exist(self):
        """迁移文件存在"""
        sql_files = list(MIGRATIONS_DIR.glob("*.sql"))
        assert len(sql_files) > 0, "至少要有一个迁移文件"

    def test_001_analysis_tasks_sql_contains_table(self):
        """001 迁移包含 analysis_tasks 表创建"""
        sql_path = MIGRATIONS_DIR / "001_create_analysis_tasks.sql"
        assert sql_path.exists()
        content = sql_path.read_text(encoding="utf-8")
        assert "CREATE TABLE" in content
        assert "analysis_tasks" in content
        assert "IF NOT EXISTS" in content

    def test_001_analysis_tasks_sql_has_required_columns(self):
        """001 迁移包含必需字段"""
        sql_path = MIGRATIONS_DIR / "001_create_analysis_tasks.sql"
        content = sql_path.read_text(encoding="utf-8")
        required = ["task_id", "user_id", "period", "status", "request_json", "result_json"]
        for col in required:
            assert col in content, f"缺少字段: {col}"

    def test_sql_syntax_has_valid_structure(self):
        """SQL 迁移文件结构完整"""
        sql_path = MIGRATIONS_DIR / "001_create_analysis_tasks.sql"
        content = sql_path.read_text(encoding="utf-8")
        # 验证基本 SQL 结构
        assert content.strip().startswith("--"), "迁移文件应以注释开头"
        assert "CREATE TABLE" in content
        assert "IF NOT EXISTS" in content
        assert ";" in content, "SQL 语句应以分号结尾"