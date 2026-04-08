"""
用户认证模块

提供用户认证、授权相关功能
"""

from .dependencies import (
    ANONYMOUS_USER,
    AuthMiddleware,
    CurrentUser,
    OptionalUser,
    UserContext,
    get_current_active_user,
    get_current_user,
    get_optional_user,
    require_auth,
    verify_token,
)

__all__ = [
    # 核心类
    "UserContext",
    "ANONYMOUS_USER",
    "AuthMiddleware",
    # 依赖函数
    "get_current_user",
    "get_current_active_user",
    "get_optional_user",
    "require_auth",
    "verify_token",
    # 便捷类型
    "CurrentUser",
    "OptionalUser",
]
