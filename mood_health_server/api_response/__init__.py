"""
API响应模块

提供统一的响应格式和异常处理
"""

from .responses import (
    BaseResponse,
    ErrorResponse,
    HealthStatus,
    PaginatedResponse,
    SuccessResponse,
    create_error_response,
    create_health_response,
    create_paginated_response,
    create_response,
    create_success_response,
)
from .exceptions import (
    APIException,
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    RateLimitException,
    ServiceUnavailableException,
    ValidationException,
    raise_forbidden,
    raise_not_found,
    raise_service_unavailable,
    raise_unauthorized,
    raise_validation_error,
    setup_exception_handlers,
)
from .health import (
    health_router,
    register_health_routes,
    system_health_check,
)

__all__ = [
    # Responses
    "BaseResponse",
    "SuccessResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "HealthStatus",
    "create_response",
    "create_success_response",
    "create_error_response",
    "create_paginated_response",
    "create_health_response",
    # Exceptions
    "APIException",
    "NotFoundException",
    "ValidationException",
    "AuthenticationException",
    "AuthorizationException",
    "ServiceUnavailableException",
    "RateLimitException",
    # Exception Helpers
    "setup_exception_handlers",
    "raise_not_found",
    "raise_validation_error",
    "raise_unauthorized",
    "raise_forbidden",
    "raise_service_unavailable",
    # Health Check
    "health_router",
    "register_health_routes",
    "system_health_check",
]
