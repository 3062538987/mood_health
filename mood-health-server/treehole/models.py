"""
树洞温柔回复数据模型
"""

from typing import Optional
from pydantic import BaseModel, Field


class GentleReplyRequest(BaseModel):
    """
    温柔回复请求模型
    
    用户提交树洞内容，请求温柔回复
    """
    content: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="用户发布的树洞内容",
        examples=["最近学习压力很大，感觉很焦虑，不知道该怎么办"]
    )
    user_id: Optional[int] = Field(
        default=None,
        description="用户ID（用于记录调用日志）"
    )


class GentleReplyResponse(BaseModel):
    """
    温柔回复响应模型
    
    AI生成的温柔、治愈系回复
    """
    reply: str = Field(
        ...,
        description="温柔回复内容",
        examples=["学习压力大的时候，记得给自己一些喘息的空间。你已经很努力了，适当的休息不是懈怠，而是为了更好地前行。"]
    )
    is_fallback: bool = Field(
        default=False,
        description="是否为兜底回复（当AI服务异常时使用）"
    )


class ContentAuditRequest(BaseModel):
    """
    内容审核请求模型
    """
    content: str = Field(
        ...,
        description="需要审核的内容"
    )


class ContentAuditResponse(BaseModel):
    """
    内容审核响应模型
    """
    is_valid: bool = Field(
        ...,
        description="内容是否通过审核"
    )
    reason: Optional[str] = Field(
        default=None,
        description="审核不通过的原因"
    )
