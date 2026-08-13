"""
内部服务认证测试 — HMAC-SHA256 签名验证 + Nonce 重放保护。
不依赖 Redis 连接。
"""

import time

import pytest

from app.auth import (
    CLOCK_SKEW,
    LOCAL_NONCE_CACHE_MAX_ENTRIES,
    LocalNonceReplayCache,
    compute_signature,
    generate_auth_headers,
    verify_internal_auth,
    verify_timestamp,
)


class TestComputeSignature:
    def test_uses_v1_canonical_fixed_vector(self):
        assert compute_signature(
            '{"mood":"calm"}',
            "1700000000",
            "abcdef0123456789abcdef0123456789",
            "fixed-vector-token",
        ) == "0a8253f71ee6fc36af6eab8a2f1d05d7c4e9f461e0fe026904c9d9008d44bf63"

    def test_different_nonce_changes_signature(self):
        body = '{"mood":"calm"}'
        timestamp = "1700000000"
        token = "fixed-vector-token"
        old_signature = compute_signature(
            body, timestamp, "abcdef0123456789abcdef0123456789", token
        )
        assert old_signature != compute_signature(
            body, timestamp, "0123456789abcdef0123456789abcdef", token
        )

    def test_consistent(self):
        """相同输入产生相同签名"""
        sig1 = compute_signature("body", "123", "nonce-value", "token")
        sig2 = compute_signature("body", "123", "nonce-value", "token")
        assert sig1 == sig2
        assert len(sig1) == 64  # SHA256 hex

    def test_different_body(self):
        """不同 body 产生不同签名"""
        sig1 = compute_signature("body1", "123", "nonce-value", "token")
        sig2 = compute_signature("body2", "123", "nonce-value", "token")
        assert sig1 != sig2

    def test_different_timestamp(self):
        """不同 timestamp 产生不同签名"""
        sig1 = compute_signature("body", "100", "nonce-value", "token")
        sig2 = compute_signature("body", "200", "nonce-value", "token")
        assert sig1 != sig2

    def test_different_token(self):
        """不同 token 产生不同签名"""
        sig1 = compute_signature("body", "123", "nonce-value", "token1")
        sig2 = compute_signature("body", "123", "nonce-value", "token2")
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

        expected_sig = compute_signature(
            body, headers["X-Timestamp"], headers["X-Nonce"], "secret-token"
        )
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

    def test_signature_cannot_be_reused_with_a_different_nonce(self, monkeypatch):
        monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "secret")
        from app.config import get_settings

        get_settings.cache_clear()
        import asyncio

        timestamp = str(int(time.time()))
        old_signature = compute_signature("body", timestamp, "nonce-one-12345", "secret")

        async def run():
            ok, err = await verify_internal_auth(
                "body", old_signature, timestamp, "nonce-two-12345"
            )
            assert not ok
            assert "签名验证失败" in err

        asyncio.run(run())

    def test_expired_timestamp_fails_before_nonce_validation(self, monkeypatch):
        monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "secret")
        from app.config import get_settings

        get_settings.cache_clear()
        import asyncio

        timestamp = str(int(time.time()) - CLOCK_SKEW - 1)
        signature = compute_signature("body", timestamp, "nonce-expired-12345", "secret")

        async def run():
            ok, err = await verify_internal_auth(
                "body", signature, timestamp, "nonce-expired-12345"
            )
            assert not ok
            assert "偏差过大" in err

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


class TestLocalNonceReplayCache:
    def test_expired_nonce_can_be_used_again(self):
        cache = LocalNonceReplayCache(ttl=300, max_entries=10_000)

        assert cache.check_and_store("nonce-expiry-12345", now=1_000)
        assert not cache.check_and_store("nonce-expiry-12345", now=1_299)
        assert cache.check_and_store("nonce-expiry-12345", now=1_300)

    def test_capacity_removes_expired_entries_before_oldest_live_entry(self):
        cache = LocalNonceReplayCache(ttl=300, max_entries=2)
        assert cache.check_and_store("nonce-expired-123", now=0)
        assert cache.check_and_store("nonce-live-old-123", now=299)
        assert cache.check_and_store("nonce-live-new-123", now=300)

        assert len(cache.entries) == 2
        assert "nonce-expired-123" not in cache.entries
        assert "nonce-live-old-123" in cache.entries
        assert "nonce-live-new-123" in cache.entries

    def test_capacity_evicts_oldest_live_entry_and_never_exceeds_limit(self):
        cache = LocalNonceReplayCache()
        for index in range(LOCAL_NONCE_CACHE_MAX_ENTRIES):
            assert cache.check_and_store(f"nonce-{index:05d}-12345", now=1)
        assert cache.check_and_store("nonce-newest-123", now=1)

        assert len(cache.entries) == LOCAL_NONCE_CACHE_MAX_ENTRIES
        assert "nonce-00000-12345" not in cache.entries
        assert "nonce-00001-12345" in cache.entries
        assert "nonce-newest-123" in cache.entries


@pytest.mark.asyncio
async def test_redis_unavailable_uses_local_replay_protection(monkeypatch):
    import app.auth as auth_mod

    monkeypatch.setattr("app.main.get_redis_client", lambda: None)
    monkeypatch.setattr(auth_mod, "_local_nonce_cache", LocalNonceReplayCache())

    assert await auth_mod.verify_nonce("nonce-local-12345") == (True, "")
    replay_ok, replay_error = await auth_mod.verify_nonce("nonce-local-12345")
    assert not replay_ok
    assert "nonce 已被使用" in replay_error
