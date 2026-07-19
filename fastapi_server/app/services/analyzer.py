from app.models.contracts import MoodAnalysisRequest, MoodAnalysisResponse, PatternItem, ActionItem


def analyze_mood(request: MoodAnalysisRequest) -> MoodAnalysisResponse:
    total_metrics = len(request.metrics)
    total_trend = len(request.trend)
    total_triggers = len(request.triggers)
    period = request.period

    return MoodAnalysisResponse(
        summary=f"在{period}周期内，您共记录了{total_trend}天的心情数据，"
                f"包含{total_metrics}个情绪标签。"
                "情绪状态总体平稳，建议继续保持规律记录。",
        patterns=[
            PatternItem(
                title="情绪波动模式",
                observation=f"在{period}周期内情绪波动幅度在正常范围",
                evidence=f"基于{total_trend}天的趋势数据分析",
                caveat="样本量较少时模式可能不够稳定",
            ),
            PatternItem(
                title="触发因素关联",
                observation=f"记录了{total_triggers}个潜在触发因素",
                evidence="基于标签关联分析",
            ),
        ],
        possibleFactors=[
            "日常压力",
            "作息规律",
            "社交互动",
        ],
        actions=[
            ActionItem(
                title="情绪记录",
                steps=["每天记录一次心情", "尝试标注触发因素"],
                estimatedMinutes=5,
            ),
            ActionItem(
                title="自我关怀",
                steps=["保持规律作息", "适当运动"],
                estimatedMinutes=30,
            ),
        ],
        whenToSeekHelp="如果连续两周情绪持续低落，建议寻求专业帮助",
        warnings=["本分析仅供参考，不构成医疗建议"],
        provider="mood_health_ai_service",
        model="mood-analyzer-v1",
        promptVersion="1.0.0",
    )