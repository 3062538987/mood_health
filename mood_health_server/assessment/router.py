"""
心理测评路由模块

提供心理测评相关的 API 接口路由定义
"""

from typing import List

from fastapi import APIRouter, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from common import get_logger
from .models import AssessmentRequest, AssessmentResponse
from .service import (
    assessment_analyze_mood,
    get_assessment_service,
    calculate_score,
    generate_report,
)

logger = get_logger(__name__)

# 创建限流器
limiter = Limiter(key_func=get_remote_address)

# 创建路由
router = APIRouter(
    prefix="/assessment",
    tags=["心理测评"],
    responses={
        404: {"description": "未找到"},
        500: {"description": "服务器内部错误"},
        503: {"description": "服务不可用"},
    },
)


@router.post(
    "/analyze-mood",
    response_model=AssessmentResponse,
    summary="情绪分析",
    description="分析用户情绪状态并提供疏导建议",
    response_description="情绪分析结果和建议"
)
@limiter.limit("10/minute")
async def analyze_mood(
    request: Request,
    data: AssessmentRequest
) -> AssessmentResponse:
    """
    情绪分析接口
    
    接收用户的情绪描述和强度等级，返回专业的情绪分析和疏导建议。
    结果会被缓存1小时以提高性能。
    
    Args:
        request: FastAPI 请求对象
        data: 情绪分析请求数据
        
    Returns:
        AssessmentResponse: 情绪分析结果
        
    Raises:
        HTTPException: 当服务不可用或分析失败时抛出
    """
    try:
        # 从请求中获取用户ID（如果有）
        user_id = getattr(request.state, 'user_id', None)
        
        # 调用服务进行情绪分析
        result = assessment_analyze_mood(
            content=data.content,
            mood_level=data.mood_level,
            use_cache=True,
            user_id=user_id
        )
        return result
        
    except ValueError as e:
        logger.warning(f"参数验证失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"请求参数错误: {str(e)}"
        )
        
    except ConnectionError as e:
        logger.error(f"Ollama 服务连接失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI 模型服务暂时不可用，请稍后重试"
        )
        
    except TimeoutError as e:
        logger.error(f"Ollama 服务请求超时: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI 模型响应超时，请稍后重试"
        )
        
    except Exception as e:
        logger.exception(f"情绪分析失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"情绪分析失败: {str(e)}"
        )


@router.post(
    "/batch-analyze",
    response_model=List[AssessmentResponse],
    summary="批量情绪分析",
    description="批量分析多个情绪记录"
)
@limiter.limit("5/minute")
async def batch_analyze(
    request: Request,
    data_list: List[AssessmentRequest]
) -> List[AssessmentResponse]:
    """
    批量情绪分析接口
    
    同时分析多个情绪记录，适用于批量处理场景。
    
    Args:
        request: FastAPI 请求对象
        data_list: 情绪分析请求数据列表
        
    Returns:
        List[AssessmentResponse]: 情绪分析结果列表
    """
    if len(data_list) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="批量分析最多支持10条记录"
        )
    
    try:
        service = get_assessment_service()
        results = service.batch_analyze(data_list)
        return results
        
    except Exception as e:
        logger.exception(f"批量分析失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量分析失败: {str(e)}"
        )


@router.get(
    "/health",
    summary="健康检查",
    description="检查心理测评服务的健康状态"
)
async def health_check():
    """
    健康检查接口
    
    返回服务的健康状态，包括 Ollama 连接状态、模型可用性等。
    
    Returns:
        dict: 健康状态信息
    """
    try:
        service = get_assessment_service()
        status_info = service.health_check()
        return status_info
        
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return {
            "service": "assessment",
            "status": "unhealthy",
            "error": str(e)
        }


@router.post(
    "/calculate-score",
    summary="计算测评得分",
    description="根据答案和计分规则计算测评得分"
)
async def calculate_assessment_score(
    answers: List[dict],
    scoring_rules: dict
):
    """
    计算测评得分接口
    
    Args:
        answers: 答案列表
        scoring_rules: 计分规则
        
    Returns:
        dict: 得分结果
    """
    try:
        score = calculate_score(answers, scoring_rules)
        return {
            "score": score,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"计分失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"计分失败: {str(e)}"
        )


@router.post(
    "/generate-report",
    summary="生成测评报告",
    description="根据得分生成完整的测评报告"
)
async def generate_assessment_report(
    score: int,
    max_score: int,
    result_categories: List[dict]
):
    """
    生成测评报告接口
    
    Args:
        score: 实际得分
        max_score: 满分
        result_categories: 结果分类标准
        
    Returns:
        dict: 测评报告
    """
    try:
        report = generate_report(score, max_score, result_categories)
        return report
    except Exception as e:
        logger.error(f"生成报告失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"生成报告失败: {str(e)}"
        )


# 向后兼容的路由别名
# 为了兼容旧版 API，保留 /api/analyze-mood 路径
from fastapi import FastAPI

# 这个函数用于在主应用中注册兼容路由
def register_legacy_routes(app: FastAPI):
    """
    注册向后兼容的路由
    
    为了兼容旧版 API 路径，将 /api/analyze-mood 映射到新的接口
    """
    @app.post("/api/analyze-mood", response_model=AssessmentResponse)
    @limiter.limit("10/minute")
    async def legacy_analyze_mood(request: Request, data: AssessmentRequest):
        """向后兼容的情绪分析接口"""
        return await analyze_mood(request, data)
