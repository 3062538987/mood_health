"""
树洞温柔回复路由模块

提供树洞温柔回复的API接口
"""

from fastapi import APIRouter, HTTPException, status
from typing import Optional

from common import get_logger
from .models import GentleReplyRequest, GentleReplyResponse
from .service import TreeHoleService

logger = get_logger(__name__)

# 创建路由
router = APIRouter(prefix="/treehole", tags=["树洞"])

# 创建服务实例
treehole_service = TreeHoleService()


@router.post(
    "/gentle-reply",
    response_model=GentleReplyResponse,
    summary="生成树洞温柔回复",
    description="根据用户发布的树洞内容，生成温柔、治愈系的回复",
    responses={
        200: {
            "description": "成功生成温柔回复",
            "content": {
                "application/json": {
                    "example": {
                        "reply": "你的感受很重要，无论遇到什么，都请记得照顾好自己。",
                        "is_fallback": False
                    }
                }
            }
        },
        400: {
            "description": "请求参数错误",
            "content": {
                "application/json": {
                    "example": {"detail": "内容不能为空"}
                }
            }
        },
        500: {
            "description": "服务器内部错误",
            "content": {
                "application/json": {
                    "example": {"detail": "生成回复失败，请稍后重试"}
                }
            }
        }
    }
)
async def generate_gentle_reply(request: GentleReplyRequest) -> GentleReplyResponse:
    """
    生成树洞温柔回复
    
    - **content**: 用户的树洞内容（必填，1-1000字）
    - **user_id**: 用户ID（可选，用于记录调用日志）
    
    返回温柔、治愈系的回复内容
    """
    try:
        # 内容为空检查
        if not request.content or not request.content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="内容不能为空"
            )
        
        # 生成温柔回复
        result = await treehole_service.generate_gentle_reply(request)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成温柔回复失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成回复失败，请稍后重试"
        )


@router.post(
    "/gentle-reply/retry",
    response_model=GentleReplyResponse,
    summary="生成树洞温柔回复（带重试）",
    description="根据用户发布的树洞内容，生成温柔、治愈系的回复（带重试机制）"
)
async def generate_gentle_reply_with_retry(
    request: GentleReplyRequest,
    max_retries: Optional[int] = 2
) -> GentleReplyResponse:
    """
    生成树洞温柔回复（带重试机制）
    
    - **content**: 用户的树洞内容（必填，1-1000字）
    - **user_id**: 用户ID（可选，用于记录调用日志）
    - **max_retries**: 最大重试次数（可选，默认2次）
    
    返回温柔、治愈系的回复内容
    """
    try:
        # 内容为空检查
        if not request.content or not request.content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="内容不能为空"
            )
        
        # 生成温柔回复（带重试）
        result = await treehole_service.generate_reply_with_retry(
            request, 
            max_retries=max_retries
        )
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成温柔回复失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成回复失败，请稍后重试"
        )
