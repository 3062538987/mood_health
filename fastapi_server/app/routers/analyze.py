from fastapi import APIRouter, HTTPException
from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse
from app.services.analyzer import analyze_mood

router = APIRouter()


@router.post("/api/analyze/mood", response_model=MoodAnalysisResponse)
async def analyze(request: MoodAnalysisRequest):
    try:
        return analyze_mood(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")