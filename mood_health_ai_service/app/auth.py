"""
内部服务认证 — HMAC-SHA256 签名 + Nonce 重放保护。

请求头:
  X-Signature: HMAC-SHA256(requestBody + timestamp + token)
  X-Timestamp: Unix 秒级时间戳
  X-Nonce: 唯一随机字符串 (UUID)

时间窗口: ±5 分钟
Nonce 有效期: 5 分钟 (Redis TTL)
"""

import hashlib
import hmac
import time
import uuid
from typing import Optional, Tuple

from app.config import get_settings


NONCE_TTL = 300  # 5 分钟
CLOCK_SKEW = 300  # ±5 分钟


def compute_signature(body: str, timestamp: str, token: str) -> str:
    """计算 HMAC-SHA256 签名"""
    message = f"{body}{timestamp}{token}"
    return hmac.new(
        token.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_timestamp(timestamp_str: str) -> Tuple[bool, str]:
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


async def verify_nonce(nonce: str) -> Tuple[bool, str]:
    """验证 Nonce 未被使用过，并写入 Redis"""
    if not nonce or len(nonce) < 8:
        return False, "nonce 无效"

    settings = get_settings()
    from app.main import get_redis_client

    redis_client = get_redis_client()
    if redis_client is None:
        # Redis 不可用 — 降级为仅验证签名，允许放行但记录警告
        import logging
        logger = logging.getLogger("mood_ai_service")
        logger.warning("Redis 不可用，nonce 重放保护降级")
        return True, ""

    redis_key = f"nonce:{nonce}"
    # SET NX: 仅当 key 不存在时设置，返回 True 表示首次使用
    was_set = await redis_client.set(redis_key, "1", ex=NONCE_TTL, nx=True)
    if not was_set:
        return False, f"nonce 已被使用: {nonce[:16]}..."
    return True, ""


async def verify_internal_auth(
    body: str,
    signature: Optional[str],
    timestamp: Optional[str],
    nonce: Optional[str],
) -> Tuple[bool, str]:
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

    expected = compute_signature(body, timestamp, token)
    if not hmac.compare_digest(expected, signature):
        return False, "签名验证失败"

    # 3. 验证 Nonce (防重放)
    nonce_ok, nonce_err = await verify_nonce(nonce)
    if not nonce_ok:
        return False, nonce_err

    return True, ""


def generate_auth_headers(body: str, token: str) -> dict:
    """生成认证请求头 (用于 Node 客户端调用)"""
    ts = str(int(time.time()))
    nonce = uuid.uuid4().hex
    signature = compute_signature(body, ts, token)
    return {
        "X-Signature": signature,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
    }