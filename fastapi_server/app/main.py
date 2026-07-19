from fastapi import FastAPI
from app.middleware.auth import HmacAuthMiddleware
from app.routers.analyze import router as analyze_router
from app.routers.health import router as health_router

app = FastAPI(
    title="Mood Health AI Service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(HmacAuthMiddleware)

app.include_router(health_router)
app.include_router(analyze_router)