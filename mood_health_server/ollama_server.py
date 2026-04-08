from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import requests
import json
import redis
import hashlib
import time
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DeepSeek 1.5B 情绪分析服务 (Ollama)")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b")

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
try:
    redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
    redis_client.ping()
    logger.info("Redis 连接成功")
except Exception as e:
    logger.warning(f"Redis 连接失败，将不使用缓存: {e}")
    redis_client = None

class MoodRequest(BaseModel):
    content: str
    mood_level: int

class MoodAnalysisResponse(BaseModel):
    analysis: str
    suggestions: list[str]

def get_cache_key(content: str, mood_level: int) -> str:
    text = f"{content}:{mood_level}"
    return hashlib.md5(text.encode()).hexdigest()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info(f"{request.method} {request.url.path} - {duration:.3f}s - {response.status_code}")
    return response

@app.post("/api/analyze-mood")
@limiter.limit("10/minute")
async def analyze_mood(request: Request, data: MoodRequest):
    try:
        if redis_client:
            cache_key = get_cache_key(data.content, data.mood_level)
            cached = redis_client.get(cache_key)
            if cached:
                logger.info(f"命中缓存: {cache_key}")
                return json.loads(cached)

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一名专业的大学生心理健康咨询师，请为用户提供专业、温和、实用的情绪疏导建议。"
                    },
                    {
                        "role": "user",
                        "content": f"""请根据以下信息为用户提供情绪分析建议：

情绪描述：{data.content}
情绪强度：{data.mood_level}/10

要求：
1. 首先对用户的情绪状态进行分析（50字以内）
2. 提供3-5条具体、可执行的建议
3. 建议简洁明了，适合大学生理解和执行
4. 语气亲切，避免专业术语堆砌
5. 每条建议控制在30字以内

请按以下JSON格式返回（不要包含其他文字）：
{{
  "analysis": "情绪分析内容",
  "suggestions": ["建议1", "建议2", "建议3"]
}}"""
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 500
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Ollama API错误: {response.text}")
        
        result = response.json()
        ai_response = result.get("message", {}).get("content", "").strip()
        
        try:
            json_start = ai_response.find("{")
            json_end = ai_response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                json_str = ai_response[json_start:json_end]
                parsed_result = json.loads(json_str)
                
                if not isinstance(parsed_result.get("analysis"), str):
                    parsed_result["analysis"] = ai_response[:200]
                if not isinstance(parsed_result.get("suggestions"), list):
                    parsed_result["suggestions"] = [ai_response[i:i+50] for i in range(0, len(ai_response), 50)][:3]
            else:
                parsed_result = {
                    "analysis": ai_response[:200],
                    "suggestions": [ai_response[i:i+50] for i in range(0, len(ai_response), 50)][:3]
                }
        except json.JSONDecodeError:
            parsed_result = {
                "analysis": ai_response[:200],
                "suggestions": [ai_response[i:i+50] for i in range(0, len(ai_response), 50)][:3]
            }
        
        if redis_client:
            redis_client.setex(cache_key, 3600, json.dumps(parsed_result))
            logger.info(f"结果已缓存: {cache_key}")
        
        return parsed_result

    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="无法连接到Ollama服务，请确保Ollama正在运行")
    except Exception as e:
        logger.error(f"分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

@app.get("/health")
async def health_check():
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            has_deepseek = any(MODEL_NAME in model.get("name", "") for model in models)
            redis_status = redis_client is not None
            return {
                "status": "healthy",
                "ollama_connected": True,
                "model_available": has_deepseek,
                "redis_connected": redis_status
            }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
    
    return {
        "status": "unhealthy",
        "ollama_connected": False,
        "model_available": False,
        "redis_connected": redis_client is not None
    }
