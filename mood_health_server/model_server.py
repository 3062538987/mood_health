from fastapi import FastAPI,  HTTPException 
from pydantic import  BaseModel 
import  torch 
from transformers import AutoTokenizer,  AutoModelForCausalLM 

# 初始化FastAPI应用 
app = FastAPI(title="DeepSeek 1.5B 情绪分析服务") 

# 配置模型路径（替换成你下载的DeepSeek 1.5B路径） 
MODEL_PATH = "./deepseek-chat-1.5b"  # 建议把模型放在这个目录下 

# 加载模型和Tokenizer（仅启动时加载一次） 
try: 
    # 检查CUDA 
    device = "cuda" if torch.cuda.is_available() else "cpu" 
    print(f"使用设备: {device}") 
    
    # 加载Tokenizer 
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True) 
    
    # 加载模型（适配1.5B小模型，优化内存占用） 
    model = AutoModelForCausalLM.from_pretrained( 
        MODEL_PATH, 
        torch_dtype=torch.float16 if device == "cuda" else torch.float32, 
        trust_remote_code=True, 
        device_map="auto"  # 自动分配GPU/CPU 
    ) 
    print("✅ DeepSeek 1.5B 模型加载成功") 

except Exception as e: 
    raise RuntimeError(f"模型加载失败: {str(e)}") 

# 定义请求体格式 
class MoodAnalysisRequest(BaseModel): 
    mood_type: str  # 情绪类型：焦虑、抑郁、开心等 
    intensity: int   # 情绪强度：1-10 
    remark: str      # 情绪备注：如"考试压力大" 

# 定义情绪分析接口 
@app.post("/api/analyze-mood") 
async def analyze_mood(request: MoodAnalysisRequest): 
    try: 
        # 构建提示词（适配情绪分析场景） 
        prompt = f"""
        你是一名专业的大学生心理健康咨询师，请根据以下信息为用户提供专业、温和、实用的情绪疏导建议：
        1. 情绪类型：{request.mood_type}
        2. 情绪强度：{request.intensity} /10
        3. 补充说明：{request.remark}
        
        要求：
        - 建议简洁明了，适合大学生理解和执行
        - 语气亲切，避免专业术语堆砌
        - 长度控制在200字以内
        """
        
        # 模型推理 
        inputs = tokenizer(prompt, return_tensors="pt").to(device) 
        outputs = model.generate( 
            **inputs, 
            max_new_tokens=200,  # 生成文本最大长度 
            temperature=0.7,     # 生成随机性 
            top_p=0.9, 
            do_sample=True, 
            pad_token_id=tokenizer. eos_token_id 
        ) 
        
        # 解析结果 
        response = tokenizer.decode(outputs[0], skip_special_tokens=True).replace(prompt, "").strip() 
        
        return { 
            "code": 200, 
            "message": "success", 
            "data": { 
                "suggestion": response, 
                "mood_type": request.mood_type, 
                "intensity": request. intensity 
            } 
        } 

    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}") 

# 健康检查接口 
@app.get("/health") 
async def health_check(): 
    return { 
        "status": "healthy", 
        "model_loaded": True, 
        "cuda_available": torch.cuda.is_available() 
    } 

# 启动命令：uvicorn model_server:app --host 0.0.0.0 --port 8000