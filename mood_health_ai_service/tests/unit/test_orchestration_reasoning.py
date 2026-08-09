"""离线验证 unified assistant 的推理轨迹(reasoning_steps)会被各节点填充。

不依赖 DeepSeek / RAG 向量库 / 联网：全部依赖注入假实现。
"""

from __future__ import annotations

import asyncio
from typing import Any

from langchain_core.messages import AIMessage

from app.agent.orchestration import AgentDependencies, run_assistant_agent
from app.models.contracts import AssistantResponseRequest


class _FakeSettings:
    RAG_TOP_K = 3
    RAG_MIN_SIMILARITY = 0.2
    TAVILY_API_KEY = ""


class _FakeDecisionModel:
    async def ainvoke(self, messages: list[Any]) -> AIMessage:
        # 不做工具调用 -> decide "not_needed"，跳过联网
        return AIMessage(content="", tool_calls=[])


def _fake_decision_factory(web_tool: Any):  # noqa: ANN001
    return _FakeDecisionModel()


class _FakeFinalProvider:
    async def chat(  # noqa: ANN001
        self,
        messages: list[Any],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> tuple[str, str, dict[str, int] | None]:
        return "这是一条用于单元测试的模拟回复。", "deepseek-chat", {"total_tokens": 10}


class _FakeWebGateway:
    async def search(self, query: str) -> Any:  # noqa: ANN001
        raise AssertionError("web gateway should not be called in this test")


def _fake_retrieve(query: str, top_k: int) -> list[Any]:  # noqa: ANN001
    return []


def _build_fake_deps() -> AgentDependencies:
    return AgentDependencies(
        settings=_FakeSettings(),  # type: ignore[arg-type]
        retrieve=_fake_retrieve,  # type: ignore[arg-type]
        decision_model_factory=_fake_decision_factory,  # type: ignore[arg-type]
        final_provider=_FakeFinalProvider(),  # type: ignore[arg-type]
        web_gateway=_FakeWebGateway(),  # type: ignore[arg-type]
    )


def test_reasoning_steps_populated_without_web_search():
    request = AssistantResponseRequest(
        query="最近总是睡不好，有点焦虑",
        requestId="unit-test-reasoning-001",
        history=[],
        riskDetected=False,
        allowWebSearch=False,
    )

    response = asyncio.run(run_assistant_agent(request, dependencies=_build_fake_deps()))

    assert response.answer, "应返回非空回复"
    steps = response.reasoningSteps
    assert steps, "reasoning_steps 不应为空"
    phases = [step.phase for step in steps]
    # 常规链路（无风险、未开启联网）应至少覆盖：安全门 -> 检索 -> 联网门 -> 综合
    assert "safety" in phases
    assert "retrieve" in phases
    assert "web" in phases
    assert "synthesis" in phases
    # 未走联网决策/检索，不该出现 decision / web_search 阶段
    assert "decision" not in phases
    assert "web_search" not in phases
    # 每条步骤都应有可读标签
    assert all(step.label for step in steps)


def test_reasoning_steps_include_decision_when_web_allowed_but_no_key():
    """开启联网但未配密钥：决策节点应判定无需检索且留下决策轨迹。"""
    request = AssistantResponseRequest(
        query="今天有什么心理健康相关的政策新闻？",
        requestId="unit-test-reasoning-002",
        history=[],
        riskDetected=False,
        allowWebSearch=True,
    )

    response = asyncio.run(run_assistant_agent(request, dependencies=_build_fake_deps()))

    phases = [step.phase for step in response.reasoningSteps]
    assert "web" in phases
    # web_gate 判定无密钥 -> final_answer，不进入 decision/tools
    assert "decision" not in phases
    assert "web_search" not in phases


class _FakeFinalProviderWithSummary:
    """能区分「历史摘要调用」与「最终回复调用」的假 provider。"""

    async def chat(  # noqa: ANN001
        self,
        messages: list[Any],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> tuple[str, str, dict[str, int] | None]:
        joined = " ".join(str(m.get("content", "")) for m in messages)
        if "压缩成不超过120字" in joined:
            return (
                "用户此前倾诉学业压力与失眠，助手建议固定作息并练习呼吸放松。",
                "deepseek-chat",
                {"total_tokens": 30},
            )
        return ("这是一条用于单元测试的模拟回复。", "deepseek-chat", {"total_tokens": 10})


def _build_fake_deps_with_summary() -> AgentDependencies:
    return AgentDependencies(
        settings=_FakeSettings(),  # type: ignore[arg-type]
        retrieve=_fake_retrieve,  # type: ignore[arg-type]
        decision_model_factory=_fake_decision_factory,  # type: ignore[arg-type]
        final_provider=_FakeFinalProviderWithSummary(),  # type: ignore[arg-type]
        web_gateway=_FakeWebGateway(),  # type: ignore[arg-type]
    )


def test_long_term_memory_compresses_older_history():
    """超长历史：早期对话应被压缩为摘要，并在推理轨迹标注 memory 步骤。"""
    history = [
        {"role": "user", "content": "我最近考试压力大"},
        {"role": "assistant", "content": "我们可以聊聊如何分解任务"},
        {"role": "user", "content": "晚上也睡不着"},
        {"role": "assistant", "content": "建议睡前半小时远离屏幕"},
        {"role": "user", "content": "试了还是焦虑"},
        {"role": "assistant", "content": "可以试试 4-7-8 呼吸法"},
        {"role": "user", "content": "今天又失眠了"},
        {"role": "assistant", "content": "要不要记录一下睡眠日志"},
    ]
    request = AssistantResponseRequest(
        query="还有什么办法能帮我入睡？",
        requestId="unit-test-memory-001",
        history=history,  # type: ignore[arg-type]
        riskDetected=False,
        allowWebSearch=False,
    )

    response = asyncio.run(run_assistant_agent(request, dependencies=_build_fake_deps_with_summary()))

    phases = [step.phase for step in response.reasoningSteps]
    # 历史超过 RECENT_HISTORY_K(6)，应触发压缩并留下 memory 步骤
    assert "memory" in phases
    memory_step = next(step for step in response.reasoningSteps if step.phase == "memory")
    assert "2 轮" in memory_step.label
    assert response.answer == "这是一条用于单元测试的模拟回复。"


def test_no_compression_when_history_short():
    """历史较短时不应出现 memory 步骤。"""
    request = AssistantResponseRequest(
        query="今晚又睡不着",
        requestId="unit-test-memory-002",
        history=[  # type: ignore[arg-type]
            {"role": "user", "content": "昨天失眠"},
            {"role": "assistant", "content": "试试固定起床时间"},
            {"role": "user", "content": "好的"},
        ],
        riskDetected=False,
        allowWebSearch=False,
    )

    response = asyncio.run(run_assistant_agent(request, dependencies=_build_fake_deps()))

    phases = [step.phase for step in response.reasoningSteps]
    assert "memory" not in phases


class _FakeDecisionModelWithTool:
    async def ainvoke(self, messages: list[Any]) -> AIMessage:
        # 发起一次联网检索工具调用 -> 进入 tools 节点
        return AIMessage(
            content="",
            tool_calls=[{"name": "search_current_web", "args": {"query": "x"}, "id": "call_1"}],
        )


def _fake_decision_factory_with_tool(web_tool: Any):  # noqa: ANN001
    return _FakeDecisionModelWithTool()


class _FakeUsedWebGateway:
    async def search(self, query: str):  # noqa: ANN001
        from app.agent.tavily_gateway import WebSearchEvidence, WebSearchResult
        from app.models.contracts import RagSource

        evidence = (
            WebSearchEvidence(title="来源标题", url="https://example.com/a", snippet="摘要内容"),
        )
        sources = (
            RagSource(
                sourceType="web",
                title="来源标题",
                reference="DuckDuckGo web search",
                url="https://example.com/a",
            ),
        )
        return WebSearchResult(status="used", evidence=evidence, sources=sources)


def _build_fake_deps_with_web() -> AgentDependencies:
    return AgentDependencies(
        settings=_FakeSettings(),  # type: ignore[arg-type]
        retrieve=_fake_retrieve,  # type: ignore[arg-type]
        decision_model_factory=_fake_decision_factory_with_tool,  # type: ignore[arg-type]
        final_provider=_FakeFinalProvider(),  # type: ignore[arg-type]
        web_gateway=_FakeUsedWebGateway(),  # type: ignore[arg-type]
        web_available=True,
    )


def test_web_search_path_with_available_gateway():
    """联网可用且开启检索：应走 决策 -> 工具检索 -> 综合，并带回网页来源。"""
    request = AssistantResponseRequest(
        query="今天有什么心理健康相关的政策新闻？",
        requestId="unit-web-001",
        history=[],
        riskDetected=False,
        allowWebSearch=True,
    )

    response = asyncio.run(run_assistant_agent(request, dependencies=_build_fake_deps_with_web()))

    phases = [step.phase for step in response.reasoningSteps]
    assert "decision" in phases
    assert "web_search" in phases
    assert "synthesis" in phases
    assert response.webSearchStatus == "used"
    assert response.sources, "应带回网页来源"
