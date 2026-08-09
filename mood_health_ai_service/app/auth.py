"""
内部服务认证 — HMAC-SHA256 签名 + Nonce 重放保护。

请求头:
  X-Signature: HMAC-SHA256(token, "v1\\n{timestamp}\\n{nonce}\\n{sha256(body)}")
  X-Timestamp: Unix 秒级时间戳
  X-Nonce: 唯一随机字符串 (UUID)

时间窗口: ±5 分钟
Nonce 有效期: 5 分钟 (Redis TTL)
"""

import hashlib
import hmac
import logging
import time
import uuid
from collections import OrderedDict

from app.config import get_settings

NONCE_TTL = 300  # 5 分钟
CLOCK_SKEW = 300  # ±5 分钟
LOCAL_NONCE_CACHE_MAX_ENTRIES = 10_000
logger = logging.getLogger("mood_ai_service")


class LocalNonceReplayCache:
    """Bounded, process-local replay cache used only when Redis is unavailable."""

    def __init__(self, ttl: int = NONCE_TTL, max_entries: int = LOCAL_NONCE_CACHE_MAX_ENTRIES):
        self.ttl = ttl
        self.max_entries = max_entries
        self.entries: OrderedDict[str, float] = OrderedDict()

    def check_and_store(self, nonce: str, now: float | None = None) -> bool:
        current_time = time.time() if now is None else now
        self._remove_expired(current_time)

        if nonce in self.entries:
            return False

        if len(self.entries) >= self.max_entries:
            self.entries.popitem(last=False)

        self.entries[nonce] = current_time + self.ttl
        return True

    def _remove_expired(self, now: float) -> None:
        expired_nonces = [nonce for nonce, expires_at in self.entries.items() if expires_at <= now]
        for nonce in expired_nonces:
            del self.entries[nonce]


_local_nonce_cache = LocalNonceReplayCache()


def compute_signature(body: str, timestamp: str, nonce: str, token: str) -> str:
    """计算 HMAC-SHA256 签名"""
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    message = f"v1\n{timestamp}\n{nonce}\n{body_hash}"
    return hmac.new(
        token.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_timestamp(timestamp_str: str) -> tuple[bool, str]:
    """验证时间戳是否在允许范围内"""
    try:
        ts = int(timestamp_str)
    except (ValueError, TypeError):
        return False, "timestamp 格式无效"

    now = int(time.time())
    diff = abs(now - ts)
    if diff > CLOCK_SKEW:
        return False, f"timestamp 偏差过大 ({diff}s > {CLOCK_SKEW}s)"
    return True, ""


async def verify_nonce(nonce: str) -> tuple[bool, str]:
    """验证 Nonce 未被使用过，并写入 Redis（fail-closed）。

    - Redis 已配置但写入失败 → 拒绝请求（宁可错杀，不可放行重放）。
    - Redis 未配置（None）→ 降级为进程内重放缓存（单进程部署可接受）。
    """
    if not nonce or len(nonce) < 8:
        return False, "nonce 无效"

    from app.main import get_redis_client

    redis_client = get_redis_client()
    if redis_client is not None:
        try:
            redis_key = f"nonce:{nonce}"
            # SET NX: only the first request may claim this nonce.
            was_set = await redis_client.set(redis_key, "1", ex=NONCE_TTL, nx=True)
            if not was_set:
                return False, "nonce 已被使用"
            return True, ""
        except Exception as exc:
            logger.error(
                "Redis nonce store failed; rejecting request to prevent replay (fail-closed) (%s)",
                type(exc).__name__,
            )
            return False, "nonce 存储失败，拒绝请求（fail-closed）"

    # Redis 未配置：降级为进程内重放缓存（单进程部署可接受）
    if _local_nonce_cache.check_and_store(nonce):
        return True, ""
    return False, "nonce 已被使用"


async def verify_internal_auth(
    body: str,
    signature: str | None,
    timestamp: str | None,
    nonce: str | None,
) -> tuple[bool, str]:
    """
    验证内部服务请求的完整认证链。

    返回 (通过, 错误信息)。
    """
    if not signature or not timestamp or not nonce:
        return False, "缺少认证头 (X-Signature, X-Timestamp, X-Nonce)"

    # 1. 验证时间戳
    ts_ok, ts_err = verify_timestamp(timestamp)
    if not ts_ok:
        return False, ts_err

    # 2. 验证签名
    settings = get_settings()
    token = settings.AI_SERVICE_INTERNAL_TOKEN
    if not token:
        return False, "AI_SERVICE_INTERNAL_TOKEN 未配置"

    expected = compute_signature(body, timestamp, nonce, token)
    if not hmac.compare_digest(expected, signature):
        return False, "签名验证失败"

    # 3. 验证 Nonce (防重放)
    nonce_ok, nonce_err = await verify_nonce(nonce)
    if not nonce_ok:
        return False, nonce_err

    return True, ""


def generate_auth_headers(body: str, token: str) -> dict[str, str]:
    """生成认证请求头 (用于 Node 客户端调用)"""
    ts = str(int(time.time()))
    nonce = uuid.uuid4().hex
    signature = compute_signature(body, ts, nonce, token)
    return {
        "X-Signature": signature,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
    }
