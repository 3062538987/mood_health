from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os

# 初始化FastAPI应用
app = FastAPI(title="DeepSeek 情绪分析服务 (API)")

# DeepSeek API配置
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "你的API_KEY")  # 从环境变量读取

# 定义请求体格式
class MoodAnalysisRequest(BaseModel):
    mood_type: str  # 情绪类型：焦虑、抑郁、开心等
    intensity: int  # 情绪强度：1-10
    remark: str     # 情绪备注：如"考试压力大"

# 定义情绪分析接口
@app.post("/api/analyze-mood")
async def analyze_mood(request: MoodAnalysisRequest):
    try:
        # 构建消息
        messages = [
            {
                "role": "system",
                "content": "你是一名专业的大学生心理健康咨询师，请为用户提供专业、温和、实用的情绪疏导建议。建议要简洁明了，适合大学生理解和执行，语气亲切，避免专业术语堆砌，长度控制在200字以内。"
            },
            {
                "role": "user",
                "content": f"情绪类型：{request.mood_type}\n情绪强度：{request.intensity}/10\n补充说明：{request.remark}\n\n请给出情绪疏导建议："
            }
        ]

        # 调用DeepSeek API
        response = requests.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 300
            },
            timeout=30
        )
        
        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", "未知错误")
            raise HTTPException(status_code=500, detail=f"DeepSeek API错误: {error_detail}")
        
        result = response.json()
        suggestion = result["choices"][0]["message"]["content"].strip()
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "suggestion": suggestion,
                "mood_type": request.mood_type,
                "intensity": request.intensity
            }
        }

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"API请求失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

# 健康检查接口
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "api_configured": DEEPSEEK_API_KEY != "你的API_KEY"
    }

# 启动命令：uvicorn deepseek_api_server:app --host 0.0.0.0 --port 8000
# 设置API Key：set DEEPSEEK_API_KEY=你的API_KEY
