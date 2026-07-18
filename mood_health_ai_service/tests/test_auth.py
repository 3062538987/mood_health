"""
内部服务认证测试 — HMAC-SHA256 签名验证 + Nonce 重放保护。
不依赖 Redis 连接。
"""

import time

import pytest

from app.auth import (
    compute_signature,
    verify_timestamp,
    verify_internal_auth,
    generate_auth_headers,
    CLOCK_SKEW,
)


class TestComputeSignature:
    def test_consistent(self):
        """相同输入产生相同签名"""
        sig1 = compute_signature("body", "123", "token")
        sig2 = compute_signature("body", "123", "token")
        assert sig1 == sig2
        assert len(sig1) == 64  # SHA256 hex

    def test_different_body(self):
        """不同 body 产生不同签名"""
        sig1 = compute_signature("body1", "123", "token")
        sig2 = compute_signature("body2", "123", "token")
        assert sig1 != sig2

    def test_different_timestamp(self):
        """不同 timestamp 产生不同签名"""
        sig1 = compute_signature("body", "100", "token")
        sig2 = compute_signature("body", "200", "token")
        assert sig1 != sig2

    def test_different_token(self):
        """不同 token 产生不同签名"""
        sig1 = compute_signature("body", "123", "token1")
        sig2 = compute_signature("body", "123", "token2")
        assert sig1 != sig2


class TestVerifyTimestamp:
    def test_now(self):
        ok, err = verify_timestamp(str(int(time.time())))
        assert ok
        assert err == ""

    def test_future_within_window(self):
        ok, _ = verify_timestamp(str(int(time.time()) + CLOCK_SKEW - 1))
        assert ok

    def test_past_within_window(self):
        ok, _ = verify_timestamp(str(int(time.time()) - CLOCK_SKEW + 1))
        assert ok

    def test_future_outside_window(self):
        ok, err = verify_timestamp(str(int(time.time()) + CLOCK_SKEW + 10))
        assert not ok
        assert "偏差过大" in err

    def test_invalid_format(self):
        ok, err = verify_timestamp("not-a-number")
        assert not ok
        assert "格式无效" in err


class TestGenerateAuthHeaders:
    def test_includes_required_headers(self):
        headers = generate_auth_headers("test body", "secret-token")
        assert "X-Signature" in headers
        assert "X-Timestamp" in headers
        assert "X-Nonce" in headers
        assert len(headers["X-Signature"]) == 64

    def test_headers_verify_correctly(self, monkeypatch):
        """生成的请求头可以通过验证"""
        monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "secret-token")
        from app.config import get_settings
        get_settings.cache_clear()
        import app.auth as auth_mod

        body = '{"requestId": "test"}'
        headers = generate_auth_headers(body, "secret-token")

        # 模拟 verify_internal_auth (跳过 nonce 因为无 Redis)
        ok, err = auth_mod.verify_timestamp(headers["X-Timestamp"])
        assert ok

        expected_sig = compute_signature(body, headers["X-Timestamp"], "secret-token")
        assert expected_sig == headers["X-Signature"]


class TestVerifyInternalAuth:
    def test_missing_headers(self):
        """缺少认证头时返回失败"""
        import asyncio

        async def run():
            ok, err = await verify_internal_auth("body", None, "123", "nonce")
            assert not ok
            assert "缺少认证头" in err

        asyncio.run(run())

    def test_wrong_signature(self, monkeypatch):
        """错误签名被拒绝"""
        monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "secret")
        from app.config import get_settings
        get_settings.cache_clear()

        import asyncio

        async def run():
            ok, err = await verify_internal_auth(
                "body",
                "wrong-signature",
                str(int(time.time())),
                "unique-nonce-12345",
            )
            assert not ok
            assert "签名验证失败" in err

        asyncio.run(run())

    def test_no_token_configured(self, monkeypatch):
        """未配置 token 时返回失败"""
        monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "")
        # 清除 lru_cache 使新 env 生效
        from app.config import get_settings
        get_settings.cache_clear()
        import asyncio

        async def run():
            ok, err = await verify_internal_auth(
                "body",
                "some-sig",
                str(int(time.time())),
                "unique-nonce",
            )
            assert not ok
            assert "未配置" in err

        asyncio.run(run())