"""
API 异常处理模块

提供全局异常处理器和自定义异常类
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from common import get_logger
from .responses import ErrorResponse, create_error_response

logger = get_logger(__name__)


class APIException(Exception):
    """
    基础 API 异常类
    
    所有自定义 API 异常的基类
    """
    
    def __init__(
        self,
        message: str = "API Error",
        code: int = 500,
        error: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.error = error or message
        self.details = details or {}
        self.timestamp = datetime.now().isoformat()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "code": self.code,
            "message": self.message,
            "error": self.error,
            "details": self.details,
            "timestamp": self.timestamp
        }


class NotFoundException(APIException):
    """资源未找到异常"""
    
    def __init__(
        self,
        message: str = "Resource not found",
        resource: str = "resource",
        resource_id: Optional[str] = None
    ):
        details = {"resource": resource}
        if resource_id:
            details["resource_id"] = resource_id
        
        super().__init__(
            message=message,
            code=status.HTTP_404_NOT_FOUND,
            error="NOT_FOUND",
            details=details
        )


class ValidationException(APIException):
    """数据验证异常"""
    
    def __init__(
        self,
        message: str = "Validation error",
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if field:
            error_details["field"] = field
        
        super().__init__(
            message=message,
            code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error="VALIDATION_ERROR",
            details=error_details
        )


class AuthenticationException(APIException):
    """认证异常"""
    
    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            code=status.HTTP_401_UNAUTHORIZED,
            error="AUTHENTICATION_FAILED",
            details=details
        )


class AuthorizationException(APIException):
    """授权异常"""
    
    def __init__(
        self,
        message: str = "Permission denied",
        resource: Optional[str] = None,
        action: Optional[str] = None
    ):
        details = {}
        if resource:
            details["resource"] = resource
        if action:
            details["action"] = action
        
        super().__init__(
            message=message,
            code=status.HTTP_403_FORBIDDEN,
            error="PERMISSION_DENIED",
            details=details
        )


class ServiceUnavailableException(APIException):
    """服务不可用异常"""
    
    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        service: Optional[str] = None
    ):
        details = {}
        if service:
            details["service"] = service
        
        super().__init__(
            message=message,
            code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error="SERVICE_UNAVAILABLE",
            details=details
        )


class RateLimitException(APIException):
    """请求频率限制异常"""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None
    ):
        details = {}
        if retry_after:
            details["retry_after"] = retry_after
        
        super().__init__(
            message=message,
            code=status.HTTP_429_TOO_MANY_REQUESTS,
            error="RATE_LIMIT_EXCEEDED",
            details=details
        )


# ==================== 全局异常处理器 ====================

def setup_exception_handlers(app: FastAPI) -> None:
    """
    设置全局异常处理器
    
    在 FastAPI 应用实例上注册所有异常处理器
    
    Args:
        app: FastAPI 应用实例
    """
    
    # 自定义 API 异常
    @app.exception_handler(APIException)
    async def api_exception_handler(request: Request, exc: APIException):
        """处理自定义 API 异常"""
        logger.warning(f"API异常: {exc.message}")
        return JSONResponse(
            status_code=exc.code,
            content=exc.to_dict()
        )
    
    # Pydantic 验证错误
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError
    ):
        """处理请求验证错误"""
        errors = exc.errors()
        
        # 简化错误信息
        simplified_errors = []
        for error in errors:
            simplified_errors.append({
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "type": error["type"]
            })
        
        logger.warning(f"验证错误: {simplified_errors}")
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=create_error_response(
                message="请求参数验证失败",
                code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error="VALIDATION_ERROR",
                details={"errors": simplified_errors}
            )
        )
    
    # Pydantic 模型验证错误
    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(
        request: Request,
        exc: ValidationError
    ):
        """处理 Pydantic 验证错误"""
        logger.warning(f"数据验证错误: {exc.errors()}")
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=create_error_response(
                message="数据验证失败",
                code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error="VALIDATION_ERROR",
                details={"errors": exc.errors()}
            )
        )
    
    # 404 未找到
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """处理 404 错误"""
        logger.warning(f"资源未找到: {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=create_error_response(
                message="请求的资源不存在",
                code=status.HTTP_404_NOT_FOUND,
                error="NOT_FOUND",
                details={"path": request.url.path}
            )
        )
    
    # 全局异常捕获
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """处理所有未捕获的异常"""
        logger.exception(f"未处理的异常: {exc}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=create_error_response(
                message="服务器内部错误",
                code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error="INTERNAL_SERVER_ERROR",
                details={"type": type(exc).__name__}
            )
        )
    
    logger.info("全局异常处理器已注册")


# ==================== 便捷函数 ====================

def raise_not_found(resource: str = "resource", resource_id: Optional[str] = None):
    """抛出资源未找到异常"""
    raise NotFoundException(resource=resource, resource_id=resource_id)


def raise_validation_error(message: str, field: Optional[str] = None):
    """抛出验证错误异常"""
    raise ValidationException(message=message, field=field)


def raise_unauthorized(message: str = "Authentication required"):
    """抛出未授权异常"""
    raise AuthenticationException(message=message)


def raise_forbidden(message: str = "Permission denied"):
    """抛出禁止访问异常"""
    raise AuthorizationException(message=message)


def raise_service_unavailable(service: Optional[str] = None):
    """抛出服务不可用异常"""
    raise ServiceUnavailableException(service=service)
