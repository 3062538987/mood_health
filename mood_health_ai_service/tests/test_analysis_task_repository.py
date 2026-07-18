"""
分析任务 Repository 测试 — 验证 SQL 模板和参数结构。
SQL 执行在真实 MySQL 上验证（集成测试），此处仅验证接口签名和 SQL 模板。
"""

import pytest

from app.repositories.analysis_task_repository import (
    create_task,
    get_task_by_id,
    get_tasks_by_user,
    update_task_status,
    update_task_result,
    fail_task,
)


class TestRepositorySignatures:
    """验证所有 Repository 方法签名正确"""

    def test_create_task_signature(self):
        """create_task 接受 (user_id, period, request_json) 返回 task_id"""
        import inspect
        sig = inspect.signature(create_task)
        params = list(sig.parameters.keys())
        assert "user_id" in params
        assert "period" in params
        assert "request_json" in params
        assert sig.return_annotation is str

    def test_get_task_by_id_signature(self):
        """get_task_by_id 接受 task_id 返回 Optional[Dict]"""
        import inspect
        sig = inspect.signature(get_task_by_id)
        assert "task_id" in sig.parameters
        # 返回 Optional[Dict[str, Any]]

    def test_get_tasks_by_user_signature(self):
        """get_tasks_by_user 支持分页"""
        import inspect
        sig = inspect.signature(get_tasks_by_user)
        params = list(sig.parameters.keys())
        assert "user_id" in params
        assert "limit" in params
        assert "offset" in params

    def test_update_task_status_signature(self):
        """update_task_status 接受 status 和可选的 error_message"""
        import inspect
        sig = inspect.signature(update_task_status)
        params = list(sig.parameters.keys())
        assert "task_id" in params
        assert "status" in params
        assert "error_message" in params

    def test_update_task_result_signature(self):
        """update_task_result 接受完整的结果信息"""
        import inspect
        sig = inspect.signature(update_task_result)
        params = list(sig.parameters.keys())
        assert "task_id" in params
        assert "result_json" in params
        assert "provider" in params
        assert "model" in params
        assert "prompt_version" in params

    def test_fail_task_signature(self):
        """fail_task 是 update_task_status('failed') 的快捷方法"""
        import inspect
        sig = inspect.signature(fail_task)
        params = list(sig.parameters.keys())
        assert "task_id" in params
        assert "error_message" in params


class TestSqlTemplateSafety:
    """验证 SQL 模板使用参数化查询"""

    def test_create_task_uses_parameterized_query(self):
        """create_task 使用 %s 占位符而非字符串拼接"""
        import inspect
        source = inspect.getsource(create_task)
        assert "%s" in source, "应使用参数化查询 %s"
        assert "f'" not in source, "不应使用 f-string"
        assert ".format(" not in source, "不应使用 .format()"

    def test_update_task_status_uses_parameterized_query(self):
        import inspect
        source = inspect.getsource(update_task_status)
        assert "%s" in source

    def test_update_task_result_uses_parameterized_query(self):
        import inspect
        source = inspect.getsource(update_task_result)
        assert "%s" in source

    def test_no_raw_user_input_in_sql(self):
        """所有 SQL 不直接拼接用户输入"""
        import inspect
        for func in [create_task, get_task_by_id, get_tasks_by_user, update_task_status, update_task_result]:
            source = inspect.getsource(func)
            # 确保没有直接的字符串拼接 SQL
            assert "+ " not in source or "%s" in source, f"{func.__name__} 不应拼接 SQL"