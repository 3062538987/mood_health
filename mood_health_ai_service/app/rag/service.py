"""Grounded answer generation for the RAG knowledge assistant."""

import asyncio

from app.config import get_settings
from app.models.contracts import RagAnswerRequest, RagAnswerResponse, RagSource
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.rag.retriever import retrieve_knowledge


class RagNotReadyError(RuntimeError):
    """Raised when retrieval cannot provide grounding context."""


async def answer_question(request: RagAnswerRequest) -> RagAnswerResponse:
    settings = get_settings()
    # 向量检索为同步 CPU/IO 密集调用，卸载到线程避免阻塞事件循环
    records = await asyncio.to_thread(
        retrieve_knowledge, request.query, settings.RAG_TOP_K
    )
    if not records:
        raise RagNotReadyError("知识库未返回可用内容")

    context = "\n\n".join(
        f"资料 {index + 1}\n内容：{item.content}\n来源：{item.reference}"
        for index, item in enumerate(records)
    )
    messages = [
        {
            "role": "system",
            "content": (
                "你是心理健康知识助手。只能根据给定资料回答；资料不足时明确说不知道。"
                "不得诊断、开药或编造来源。回答使用简体中文，并提醒紧急风险应联系"
                "当地急救或专业人员。"
            ),
        },
        *[
            {"role": history_item.role, "content": history_item.content}
            for history_item in request.history[-10:]
        ],
        {"role": "user", "content": f"资料：\n{context}\n\n问题：{request.query}"},
    ]
    provider = OpenAICompatibleProvider(settings)
    content, model, usage = await provider.chat(
        messages=messages,
        temperature=0.2,
        max_tokens=900,
    )
    if not content.strip():
        raise RuntimeError("AI provider returned an empty RAG answer")

    sources: list[RagSource] = []
    seen_references: set[str] = set()
    for record in records:
        if record.reference in seen_references:
            continue
        seen_references.add(record.reference)
        sources.append(RagSource(title=record.title, reference=record.reference))
        if len(sources) == 3:
            break

    return RagAnswerResponse(
        answer=content.strip(),
        sources=sources,
        requestId=request.requestId,
        provider="deepseek",
        model=model,
        usage=usage,
        fallbackUsed=False,
    )
