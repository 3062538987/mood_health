"""
API 响应模块

提供统一的 API 响应格式封装
"""

from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

from pydantic import BaseModel, Field

T = TypeVar("T")


class BaseResponse(BaseModel):
    """
    基础响应模型
    
    所有 API 响应的基类
    """
    code: int = Field(default=200, description="状态码")
    message: str = Field(default="success", description="响应消息")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间戳")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SuccessResponse(BaseResponse, Generic[T]):
    """
    成功响应模型
    
    用于包装成功的 API 响应数据
    """
    data: Optional[T] = Field(default=None, description="响应数据")
    
    @classmethod
    def create(cls, data: T, message: str = "success") -> "SuccessResponse[T]":
        """
        创建成功响应
        
        Args:
            data: 响应数据
            message: 响应消息
            
        Returns:
            SuccessResponse: 成功响应对象
        """
        return cls(code=200, message=message, data=data)


class ErrorResponse(BaseResponse):
    """
    错误响应模型
    
    用于包装错误的 API 响应
    """
    error: Optional[str] = Field(default=None, description="错误详情")
    details: Optional[Dict[str, Any]] = Field(default=None, description="错误详细信息")
    
    @classmethod
    def create(
        cls,
        code: int = 500,
        message: str = "Internal Server Error",
        error: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> "ErrorResponse":
        """
        创建错误响应
        
        Args:
            code: 错误状态码
            message: 错误消息
            error: 错误详情
            details: 错误详细信息
            
        Returns:
            ErrorResponse: 错误响应对象
        """
        return cls(code=code, message=message, error=error, details=details)


class PaginatedResponse(BaseResponse, Generic[T]):
    """
    分页响应模型
    
    用于包装分页数据的 API 响应
    """
    data: List[T] = Field(default=[], description="数据列表")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页大小")
    total_pages: int = Field(default=0, description="总页数")
    has_next: bool = Field(default=False, description="是否有下一页")
    has_prev: bool = Field(default=False, description="是否有上一页")
    
    @classmethod
    def create(
        cls,
        data: List[T],
        total: int,
        page: int = 1,
        page_size: int = 10
    ) -> "PaginatedResponse[T]":
        """
        创建分页响应
        
        Args:
            data: 数据列表
            total: 总记录数
            page: 当前页码
            page_size: 每页大小
            
        Returns:
            PaginatedResponse: 分页响应对象
        """
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            code=200,
            message="success",
            data=data,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )


class HealthStatus(BaseModel):
    """
    健康状态模型
    
    用于健康检查接口的响应
    """
    status: str = Field(..., description="整体健康状态: healthy/unhealthy/degraded")
    version: Optional[str] = Field(default=None, description="服务版本")
    timestamp: datetime = Field(default_factory=datetime.now, description="检查时间")
    
    # 各组件状态
    database_connected: Optional[bool] = Field(default=None, description="数据库连接状态")
    redis_connected: Optional[bool] = Field(default=None, description="Redis连接状态")
    ollama_connected: Optional[bool] = Field(default=None, description="Ollama连接状态")
    model_available: Optional[bool] = Field(default=None, description="模型可用状态")
    
    # 详细信息
    components: Optional[Dict[str, Any]] = Field(default=None, description="各组件详细状态")
    
    @classmethod
    def healthy(cls, **kwargs) -> "HealthStatus":
        """创建健康状态响应"""
        return cls(status="healthy", **kwargs)
    
    @classmethod
    def unhealthy(cls, **kwargs) -> "HealthStatus":
        """创建不健康状态响应"""
        return cls(status="unhealthy", **kwargs)
    
    @classmethod
    def degraded(cls, **kwargs) -> "HealthStatus":
        """创建降级状态响应"""
        return cls(status="degraded", **kwargs)


# 便捷函数
def create_response(
    data: Any = None,
    code: int = 200,
    message: str = "success"
) -> Dict[str, Any]:
    """
    创建统一格式的响应
    
    Args:
        data: 响应数据
        code: 状态码
        message: 响应消息
        
    Returns:
        Dict: 统一格式的响应字典
    """
    return {
        "code": code,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }


def create_success_response(data: Any, message: str = "success") -> Dict[str, Any]:
    """
    创建成功响应
    
    Args:
        data: 响应数据
        message: 响应消息
        
    Returns:
        Dict: 成功响应字典
    """
    return create_response(data=data, code=200, message=message)


def create_error_response(
    message: str = "error",
    code: int = 500,
    error: Optional[str] = None
) -> Dict[str, Any]:
    """
    创建错误响应
    
    Args:
        message: 错误消息
        code: 错误状态码
        error: 错误详情
        
    Returns:
        Dict: 错误响应字典
    """
    response = create_response(data=None, code=code, message=message)
    if error:
        response["error"] = error
    return response


def create_paginated_response(
    data: List[Any],
    total: int,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    创建分页响应
    
    Args:
        data: 数据列表
        total: 总记录数
        page: 当前页码
        page_size: 每页大小
        
    Returns:
        Dict: 分页响应字典
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    return {
        "code": 200,
        "message": "success",
        "data": data,
        "pagination": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "timestamp": datetime.now().isoformat()
    }


def create_health_response(
    status: str = "healthy",
    **kwargs
) -> Dict[str, Any]:
    """
    创建健康检查响应
    
    Args:
        status: 健康状态
        **kwargs: 其他状态信息
        
    Returns:
        Dict: 健康检查响应字典
    """
    return {
        "code": 200,
        "status": status,
        "timestamp": datetime.now().isoformat(),
        **kwargs
    }
