"""
OpenAI 兼容 API 的 Provider 实现。
支持 DeepSeek、OpenAI 等 OpenAI 兼容接口。
"""

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import Settings
from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse
from app.providers.validator import validate_analysis_response

logger = logging.getLogger("mood_ai_service")


# 情绪分析系统提示词
SYSTEM_PROMPT = """你是一位专业的心理健康支持AI。请根据用户提供的情绪记录数据，生成一份结构化的情绪分析报告。

要求：
1. summary: 用温暖、共情的语言总结用户近期的情绪状态（2-4句话）
2. patterns: 识别2-3个情绪模式，每个模式包含 title/observation/evidence，可选的 caveat
3. possibleFactors: 列出可能影响情绪的3-5个因素
4. actions: 提供2-4个具体可行的行动建议，每个包含 title/steps/estimatedMinutes
5. whenToSeekHelp: 如果发现严重信号，提供专业求助建议（否则为null）
6. warnings: 如有数据不足等限制，在此列出

重要限制：
- 不要使用 mood_score、confidence、diagnosis 等字段
- 不要给出医疗诊断
- 语气温和、专业，避免说教
- 输出必须是合法的 JSON 格式"""


class OpenAICompatibleProvider:
    """OpenAI 兼容 API 的情绪分析 Provider"""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self._settings.AI_API_KEY,
                base_url=self._settings.AI_BASE_URL,
            )
        return self._client

    def _build_user_prompt(self, request: MoodAnalysisRequest) -> str:
        """构建用户提示词"""
        parts = [f"请分析以下用户近 {request.period} 的情绪数据：\n"]

        # 情绪指标
        if request.metrics:
            parts.append("## 情绪记录")
            for m in request.metrics:
                parts.append(
                    f"- {m.date}: {m.emotionName} ({m.emotionCategory}), "
                    f"强度 {m.intensity}/10, 记录 {m.count} 次"
                )

        # 趋势
        if request.trend:
            parts.append("\n## 趋势")
            for t in request.trend:
                parts.append(
                    f"- {t.date}: 平均强度 {t.avgIntensity}/10, "
                    f"主导情绪 {t.dominantEmotion}, 记录数 {t.recordCount}"
                )

        # 触发因素
        if request.triggers:
            parts.append(f"\n## 触发因素\n{', '.join(request.triggers)}")

        # 日记
        if request.journalConsent and request.journalExcerpt:
            parts.append(f"\n## 用户日记\n{request.journalExcerpt}")

        return "\n".join(parts)

    async def analyze(self, request: MoodAnalysisRequest) -> MoodAnalysisResponse:
        """
        调用 AI 模型进行情绪分析，返回严格验证的输出。
        """
        user_prompt = self._build_user_prompt(request)

        logger.info(
            "AI 分析请求: requestId=%s, period=%s, model=%s",
            request.requestId,
            request.period,
            self._settings.AI_MODEL,
        )

        try:
            response = await self.client.chat.completions.create(
                model=self._settings.AI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=2000,
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("AI 返回空内容")

            logger.info(
                "AI 响应: requestId=%s, tokens_used=%s",
                request.requestId,
                response.usage.total_tokens if response.usage else "unknown",
            )

            # 解析 JSON
            raw = json.loads(content)

            # 严格验证输出
            result = validate_analysis_response(raw, request.requestId)

            # 注入 provider/model 信息
            result.provider = "openai"
            result.model = self._settings.AI_MODEL
            result.promptVersion = "1.0.0"

            return result

        except json.JSONDecodeError as e:
            logger.error("AI 返回非 JSON: requestId=%s, error=%s", request.requestId, e)
            raise ValueError(f"AI 返回非 JSON 格式: {e}")
        except Exception as e:
            logger.error("AI 调用失败: requestId=%s, error=%s", request.requestId, e)
            raise