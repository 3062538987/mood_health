"""LangGraph orchestration tests with real graph nodes and fake providers."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import SecretStr

from app.agent.orchestration import AgentDependencies, run_assistant_agent
from app.agent.tavily_gateway import (
    WebSearchEvidence,
    WebSearchResult,
)
from app.config import Settings
from app.models.contracts import AssistantResponseRequest, RagSource
from app.rag.retriever import RetrievedKnowledge


class FakeDecisionModel:
    def __init__(
        self,
        response: BaseMessage | None = None,
        error: Exception | None = None,
    ) -> None:
        self.response = response or AIMessage(content="")
        self.error = error
        self.invocations: list[list[BaseMessage]] = []

    async def ainvoke(self, messages: list[BaseMessage]) -> BaseMessage:
        self.invocations.append(messages)
        if self.error is not None:
            raise self.error
        return self.response


class FakeProvider:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.messages: list[dict[str, str]] = []
        self.calls = 0

    async def chat(
        self,
        messages: list[Any],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> tuple[str, str, dict[str, int] | None]:
        del model, temperature, max_tokens
        self.calls += 1
        self.messages = messages
        if self.error is not None:
            raise self.error
        return "final answer", "deepseek-v4-flash", {"totalTokens": 11}


class FakeGateway:
    def __init__(
        self,
        result: object | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = result or WebSearchResult(status="failed")
        self.error = error
        self.queries: list[str] = []

    async def search(self, query: str) -> object:
        self.queries.append(query)
        if self.error is not None:
            raise self.error
        return self.result


def tool_call(
    *,
    query: str = "current guidance",
    call_id: str = "call-1",
) -> dict[str, Any]:
    return {
        "name": "search_current_web",
        "args": {"query": query},
        "id": call_id,
        "type": "tool_call",
    }


def make_dependencies(
    *,
    decision: FakeDecisionModel | None = None,
    provider: FakeProvider | None = None,
    gateway: FakeGateway | None = None,
    records: list[RetrievedKnowledge] | None = None,
    retrieval_error: Exception | None = None,
    tavily_key: str = "test-tavily-key",
) -> tuple[AgentDependencies, list[tuple[str, int]], list[BaseTool]]:
    decision = decision or FakeDecisionModel()
    provider = provider or FakeProvider()
    gateway = gateway or FakeGateway()
    retrieval_calls: list[tuple[str, int]] = []
    bound_tools: list[BaseTool] = []

    def retrieve(query: str, limit: int) -> list[RetrievedKnowledge]:
        retrieval_calls.append((query, limit))
        if retrieval_error is not None:
            raise retrieval_error
        return list(records or [])

    def decision_factory(web_tool: BaseTool) -> FakeDecisionModel:
        bound_tools.append(web_tool)
        return decision

    dependencies = AgentDependencies(
        settings=Settings(
            _env_file=None,
            AI_API_KEY="test-deepseek-key",
            TAVILY_API_KEY=tavily_key,
        ),
        retrieve=retrieve,
        decision_model_factory=decision_factory,
        final_provider=provider,
        web_gateway=gateway,
        web_available=bool(tavily_key.strip()),
    )
    return dependencies, retrieval_calls, bound_tools


@pytest.mark.asyncio
async def test_not_authorized_answers_directly_without_decision_or_tool() -> None:
    decision = FakeDecisionModel(error=AssertionError("decision must be skipped"))
    gateway = FakeGateway(error=AssertionError("gateway must be skipped"))
    dependencies, retrieval_calls, bound_tools = make_dependencies(
        decision=decision,
        gateway=gateway,
    )

    result = await run_assistant_agent(
        AssistantResponseRequest(query="I had a hard day", requestId="direct"),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "not_requested"
    assert result.groundingUsed is False
    assert retrieval_calls == [("I had a hard day", 3)]
    assert decision.invocations == []
    assert gateway.queries == []
    assert bound_tools == []


@pytest.mark.asyncio
async def test_local_relevant_evidence_is_bounded_and_low_relevance_is_omitted() -> None:
    records = [
        RetrievedKnowledge(
            content=f"local evidence {index}",
            title=f"Local {index}",
            reference=f"Reference {index}",
            similarity=similarity,
        )
        for index, similarity in enumerate((0.91, 0.82, 0.71, 0.59))
    ]
    provider = FakeProvider()
    dependencies, _, _ = make_dependencies(provider=provider, records=records)

    result = await run_assistant_agent(
        AssistantResponseRequest(query="sleep tips", requestId="local"),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "not_requested"
    assert result.groundingUsed is True
    assert [source.title for source in result.sources] == ["Local 0", "Local 1", "Local 2"]
    final_prompt = provider.messages[-1]["content"]
    assert "local evidence 0" in final_prompt
    assert "local evidence 2" in final_prompt
    assert "local evidence 3" not in final_prompt


@pytest.mark.asyncio
async def test_authorized_model_chooses_web_once_and_snippet_stays_in_final_prompt() -> None:
    decision = FakeDecisionModel(
        AIMessage(content="PRIVATE DECISION", tool_calls=[tool_call(query="official update")])
    )
    provider = FakeProvider()
    gateway = FakeGateway(
        WebSearchResult(
            status="used",
            evidence=(
                WebSearchEvidence(
                    title="Official update",
                    url="https://example.org/update",
                    snippet="TRANSIENT WEB SNIPPET",
                ),
            ),
            sources=(
                RagSource(
                    sourceType="web",
                    title="Official update",
                    reference="Tavily web search",
                    url="https://example.org/update",
                ),
            ),
        )
    )
    dependencies, _, _ = make_dependencies(
        decision=decision,
        provider=provider,
        gateway=gateway,
    )

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="what changed recently?",
            requestId="web-used",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "used"
    assert result.groundingUsed is True
    assert gateway.queries == ["official update"]
    assert result.sources[0].sourceType == "web"
    assert result.sources[0].url is not None
    assert "TRANSIENT WEB SNIPPET" in provider.messages[-1]["content"]
    assert "TRANSIENT WEB SNIPPET" not in result.model_dump_json()
    assert "PRIVATE DECISION" not in provider.messages[-1]["content"]
    assert "PRIVATE DECISION" not in result.model_dump_json()


@pytest.mark.asyncio
async def test_multiple_proposed_tool_calls_are_truncated_to_one() -> None:
    decision = FakeDecisionModel(
        AIMessage(
            content="discard me",
            tool_calls=[
                tool_call(query="first", call_id="call-1"),
                tool_call(query="second", call_id="call-2"),
            ],
            additional_kwargs={"private_reasoning": "never expose"},
        )
    )
    gateway = FakeGateway(
        WebSearchResult(
            status="used",
            evidence=(
                WebSearchEvidence(
                    title="First",
                    url="https://example.org/first",
                    snippet="first evidence",
                ),
            ),
            sources=(
                RagSource(
                    sourceType="web",
                    title="First",
                    reference="Tavily web search",
                    url="https://example.org/first",
                ),
            ),
        )
    )
    dependencies, _, _ = make_dependencies(decision=decision, gateway=gateway)

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="latest",
            requestId="one-call",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "used"
    assert gateway.queries == ["first"]
    assert "private_reasoning" not in result.model_dump_json()


@pytest.mark.asyncio
async def test_invalid_tool_call_fails_closed_without_running_gateway() -> None:
    decision = FakeDecisionModel(
        AIMessage(
            content="discard malformed decision",
            invalid_tool_calls=[
                {
                    "name": "search_current_web",
                    "args": "{not-valid-json",
                    "id": "invalid-1",
                    "error": "invalid JSON arguments",
                    "type": "invalid_tool_call",
                }
            ],
        )
    )
    gateway = FakeGateway(error=AssertionError("invalid tool calls must not run"))
    dependencies, _, _ = make_dependencies(decision=decision, gateway=gateway)

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="latest advice",
            requestId="invalid-tool-call",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "failed"
    assert len(decision.invocations) == 1
    assert gateway.queries == []


@pytest.mark.asyncio
async def test_valid_and_invalid_tool_calls_fail_closed_without_running_gateway() -> None:
    decision = FakeDecisionModel(
        AIMessage(
            content="discard mixed decision",
            tool_calls=[tool_call(query="must-not-run")],
            invalid_tool_calls=[
                {
                    "name": "search_current_web",
                    "args": "{broken",
                    "id": "invalid-2",
                    "error": "invalid JSON arguments",
                    "type": "invalid_tool_call",
                }
            ],
        )
    )
    gateway = FakeGateway(error=AssertionError("mixed invalid calls must fail closed"))
    dependencies, _, _ = make_dependencies(decision=decision, gateway=gateway)

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="latest advice",
            requestId="mixed-tool-calls",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "failed"
    assert len(decision.invocations) == 1
    assert gateway.queries == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("gateway", "tavily_key"),
    [
        (FakeGateway(), ""),
        (FakeGateway(error=TimeoutError("timeout details")), "configured"),
        (FakeGateway(error=RuntimeError("quota details")), "configured"),
        (FakeGateway(result={"unexpected": "payload"}), "configured"),
    ],
)
async def test_missing_or_failed_gateway_degrades_to_local_answer(
    gateway: FakeGateway,
    tavily_key: str,
) -> None:
    decision = FakeDecisionModel(AIMessage(content="", tool_calls=[tool_call()]))
    local = RetrievedKnowledge(
        content="stable local evidence",
        title="Local",
        reference="Audited manifest",
        similarity=0.8,
    )
    provider = FakeProvider()
    dependencies, _, _ = make_dependencies(
        decision=decision,
        provider=provider,
        gateway=gateway,
        records=[local],
        tavily_key=tavily_key,
    )

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="latest advice",
            requestId="web-failed",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "failed"
    assert result.groundingUsed is True
    assert [source.sourceType for source in result.sources] == ["local"]
    assert "web search was unavailable" in provider.messages[-1]["content"].lower()
    if not tavily_key:
        assert decision.invocations == []
        assert gateway.queries == []
    else:
        assert len(gateway.queries) == 1


@pytest.mark.asyncio
async def test_decision_error_degrades_without_running_gateway() -> None:
    decision = FakeDecisionModel(error=RuntimeError("private decision failure"))
    gateway = FakeGateway()
    provider = FakeProvider()
    dependencies, _, _ = make_dependencies(
        decision=decision,
        provider=provider,
        gateway=gateway,
    )

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="latest advice",
            requestId="decision-failed",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "failed"
    assert gateway.queries == []
    assert "private decision failure" not in provider.messages[-1]["content"]


@pytest.mark.asyncio
async def test_authorized_no_tool_decision_reports_not_needed() -> None:
    decision = FakeDecisionModel(AIMessage(content="PRIVATE NO TOOL DECISION"))
    provider = FakeProvider()
    dependencies, _, _ = make_dependencies(decision=decision, provider=provider)

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="ordinary support",
            requestId="not-needed",
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "not_needed"
    assert "PRIVATE NO TOOL DECISION" not in provider.messages[-1]["content"]


@pytest.mark.asyncio
async def test_risk_authorized_skips_retrieval_decision_and_tool() -> None:
    decision = FakeDecisionModel(error=AssertionError("decision must be skipped"))
    gateway = FakeGateway(error=AssertionError("gateway must be skipped"))
    provider = FakeProvider()
    dependencies, retrieval_calls, bound_tools = make_dependencies(
        decision=decision,
        provider=provider,
        gateway=gateway,
        retrieval_error=AssertionError("retrieval must be skipped"),
    )

    result = await run_assistant_agent(
        AssistantResponseRequest(
            query="I may hurt myself",
            requestId="risk",
            riskDetected=True,
            allowWebSearch=True,
        ),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "not_needed"
    assert result.sources == []
    assert result.groundingUsed is False
    assert retrieval_calls == []
    assert decision.invocations == []
    assert gateway.queries == []
    assert bound_tools == []
    final_prompt = provider.messages[-1]["content"].lower()
    assert "trusted" in final_prompt
    assert "school" in final_prompt
    assert "local emergency" in final_prompt


@pytest.mark.asyncio
async def test_retrieval_failure_does_not_mark_unrequested_web_as_failed() -> None:
    dependencies, _, _ = make_dependencies(retrieval_error=RuntimeError("index unavailable"))

    result = await run_assistant_agent(
        AssistantResponseRequest(query="support me", requestId="retrieval-failed"),
        dependencies=dependencies,
    )

    assert result.webSearchStatus == "not_requested"
    assert result.groundingUsed is False


@pytest.mark.asyncio
async def test_final_provider_failure_propagates() -> None:
    provider = FakeProvider(error=RuntimeError("provider unavailable"))
    dependencies, _, _ = make_dependencies(provider=provider)

    with pytest.raises(RuntimeError, match="provider unavailable"):
        await run_assistant_agent(
            AssistantResponseRequest(query="support me", requestId="provider-failed"),
            dependencies=dependencies,
        )


def test_compiled_graph_has_no_checkpointer_or_session_store() -> None:
    from app.agent.orchestration import build_assistant_graph

    dependencies, _, _ = make_dependencies()

    graph = build_assistant_graph(dependencies)

    assert graph.checkpointer is None
    assert graph.store is None
    assert "tools" in graph.nodes
    assert "decision" in graph.nodes


@pytest.mark.asyncio
async def test_runtime_requests_reuse_dependencies_and_compiled_graph(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.agent.orchestration as orchestration

    dependencies, _, _ = make_dependencies()
    build_calls = 0
    compile_calls = 0
    real_compile = orchestration.build_assistant_graph

    def build_dependencies() -> AgentDependencies:
        nonlocal build_calls
        build_calls += 1
        return dependencies

    def compile_graph(agent_dependencies: AgentDependencies) -> Any:
        nonlocal compile_calls
        compile_calls += 1
        return real_compile(agent_dependencies)

    monkeypatch.setattr(orchestration, "build_runtime_dependencies", build_dependencies)
    monkeypatch.setattr(orchestration, "build_assistant_graph", compile_graph)

    await orchestration.run_assistant_agent(
        AssistantResponseRequest(query="first", requestId="runtime-cache-1")
    )
    await orchestration.run_assistant_agent(
        AssistantResponseRequest(query="second", requestId="runtime-cache-2")
    )

    assert build_calls == 1
    assert compile_calls == 1


def test_runtime_decision_model_uses_exact_deepseek_config_and_one_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.agent.orchestration as orchestration

    constructor_options: list[dict[str, object]] = []
    bound_tools: list[list[BaseTool]] = []

    class CapturingChatModel:
        def __init__(self, **options: object) -> None:
            constructor_options.append(options)

        def bind_tools(self, tools: list[BaseTool]) -> FakeDecisionModel:
            bound_tools.append(tools)
            return FakeDecisionModel()

    monkeypatch.setattr(orchestration, "ChatOpenAI", CapturingChatModel)
    settings = Settings(
        _env_file=None,
        AI_API_KEY="exact-secret",
        AI_BASE_URL="https://api.deepseek.example/v1",
        AI_MODEL="deepseek-v4-flash",
    )
    dependencies = orchestration.build_runtime_dependencies(settings)

    dependencies.decision_model_factory(
        StructuredTool.from_function(
            func=lambda query: query,
            name="search_current_web",
            description="test tool",
        )
    )

    assert len(constructor_options) == 1
    assert constructor_options[0]["model"] == "deepseek-v4-flash"
    assert constructor_options[0]["base_url"] == "https://api.deepseek.example/v1"
    assert constructor_options[0]["temperature"] == 0
    secret = constructor_options[0]["api_key"]
    assert isinstance(secret, SecretStr)
    assert secret.get_secret_value() == "exact-secret"
    assert len(bound_tools) == 1
    assert [tool.name for tool in bound_tools[0]] == ["search_current_web"]
