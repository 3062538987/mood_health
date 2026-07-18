"""
FastAPI 健康检查测试 — 使用 TestClient 验证 /api/health 和 /api/health/ready。
不依赖真实 MySQL/Redis 连接。
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """创建测试客户端 — 覆盖 lifespan 避免连接真实数据库"""
    import app.main as main_module

    # 重置连接池避免真实连接
    main_module._mysql_pool = None
    main_module._redis_client = None

    from app.main import app

    return TestClient(app)


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "mood_health_ai_service"
        assert "version" in data

    def test_health_ready_when_no_db_returns_503(self, client):
        """无数据库连接时返回 503"""
        import app.main as main_module

        main_module._mysql_pool = None
        main_module._redis_client = None

        resp = client.get("/api/health/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "not_ready"
        assert data["checks"]["mysql"] is False
        assert data["checks"]["redis"] is False

    def test_health_ready_when_mysql_ok(self, client, monkeypatch):
        """MySQL 可用时返回 ready"""
        import app.main as main_module

        class FakePool:
            def get_connection(self):
                class FakeConn:
                    def close(self):
                        pass
                return FakeConn()

        main_module._mysql_pool = FakePool()
        main_module._redis_client = None

        resp = client.get("/api/health/ready")
        assert resp.status_code == 503  # redis 仍不可用
        data = resp.json()
        assert data["checks"]["mysql"] is True
        assert data["checks"]["redis"] is False

    def test_health_no_sensitive_data_in_response(self, client):
        """响应不能包含密码/Token"""
        resp = client.get("/api/health")
        data = resp.json()
        for key in data:
            assert "password" not in key.lower()
            assert "token" not in key.lower()
            assert "secret" not in key.lower()