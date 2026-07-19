from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
async def health():
    return {"status": "ok", "service": "mood_health_ai_service"}


@router.get("/api/health/ready")
async def readiness():
    return {"status": "ready", "service": "mood_health_ai_service"}