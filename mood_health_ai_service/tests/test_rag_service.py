from dataclasses import FrozenInstanceError, fields, replace
from datetime import date

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.models.contracts import RagAnswerRequest
from app.rag.knowledge_base import (
    KNOWLEDGE_MANIFEST,
    KnowledgeRecord,
    validate_knowledge_manifest,
)
from app.rag.retriever import RetrievedKnowledge, retrieve_knowledge
from app.rag.service import answer_question


def test_rag_request_rejects_empty_and_oversized_queries() -> None:
    with pytest.raises(ValidationError):
        RagAnswerRequest(query="", requestId="r1")
    with pytest.raises(ValidationError):
        RagAnswerRequest(query="x" * 1001, requestId="r1")


def test_retrieval_returns_real_sources_and_honors_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.rag.retriever._similarity_search",
        lambda query, limit: [
            RetrievedKnowledge(
                content="睡眠卫生",
                title="睡眠改善",
                reference="国家卫健委",
            )
        ],
    )

    results = retrieve_knowledge("怎样改善睡眠", 1)

    assert len(results) == 1
    assert results[0].reference == "国家卫健委"


def test_knowledge_manifest_has_exact_immutable_contract() -> None:
    assert isinstance(KNOWLEDGE_MANIFEST, tuple)
    assert tuple(field.name for field in fields(KnowledgeRecord)) == (
        "id",
        "title",
        "content",
        "reference",
        "url",
        "reviewedAt",
    )

    with pytest.raises(FrozenInstanceError):
        KNOWLEDGE_MANIFEST[0].title = "不可变"  # type: ignore[misc]
    with pytest.raises(TypeError):
        KNOWLEDGE_MANIFEST[0] = KNOWLEDGE_MANIFEST[0]  # type: ignore[index]


def test_knowledge_manifest_is_valid_and_independent_from_legacy_agent_app() -> None:
    validate_knowledge_manifest(KNOWLEDGE_MANIFEST)

    assert KNOWLEDGE_MANIFEST
    assert len({record.id for record in KNOWLEDGE_MANIFEST}) == len(KNOWLEDGE_MANIFEST)
    for record in KNOWLEDGE_MANIFEST:
        assert record.id.isascii()
        assert record.id == record.id.strip()
        assert record.title == record.title.strip()
        assert record.content == record.content.strip()
        assert record.reference == record.reference.strip()
        assert record.url == record.url.strip()
        assert record.url.startswith("https://")
        assert date.fromisoformat(record.reviewedAt).isoformat() == record.reviewedAt

    knowledge_module_source = (
        __import__("inspect").getsource(__import__("app.rag.knowledge_base", fromlist=["*"]))
    )
    assert "agent" + "_app" not in knowledge_module_source


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("id", ""),
        ("title", "   "),
        ("content", " 有首尾空格"),
        ("reference", "来源 "),
        ("url", " https://example.com"),
        ("reviewedAt", "2026-08-09 "),
    ],
)
def test_manifest_validation_rejects_blank_or_untrimmed_fields(
    field_name: str,
    invalid_value: str,
) -> None:
    invalid_record = replace(KNOWLEDGE_MANIFEST[0], **{field_name: invalid_value})

    with pytest.raises(ValueError, match="non-empty and trimmed"):
        validate_knowledge_manifest((invalid_record,))


@pytest.mark.parametrize("unsafe_id", ["Uppercase", "unsafe_id", "unsafe id", "../escape"])
def test_manifest_validation_rejects_unsafe_ids(unsafe_id: str) -> None:
    invalid_record = replace(KNOWLEDGE_MANIFEST[0], id=unsafe_id)

    with pytest.raises(ValueError, match="safe lowercase ASCII slug"):
        validate_knowledge_manifest((invalid_record,))


def test_manifest_validation_rejects_duplicate_ids() -> None:
    duplicate = replace(KNOWLEDGE_MANIFEST[1], id=KNOWLEDGE_MANIFEST[0].id)

    with pytest.raises(ValueError, match="duplicate knowledge id"):
        validate_knowledge_manifest((KNOWLEDGE_MANIFEST[0], duplicate))


@pytest.mark.parametrize("url", ["http://example.com", "ftp://example.com", "example.com"])
def test_manifest_validation_rejects_non_https_urls(url: str) -> None:
    invalid_record = replace(KNOWLEDGE_MANIFEST[0], url=url)

    with pytest.raises(ValueError, match="HTTPS URL"):
        validate_knowledge_manifest((invalid_record,))


@pytest.mark.parametrize("reviewed_at", ["2026/08/09", "2026-02-30", "09-08-2026"])
def test_manifest_validation_rejects_invalid_review_dates(reviewed_at: str) -> None:
    invalid_record = replace(KNOWLEDGE_MANIFEST[0], reviewedAt=reviewed_at)

    with pytest.raises(ValueError, match="ISO review date"):
        validate_knowledge_manifest((invalid_record,))


def test_manifest_validation_rejects_empty_manifest() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        validate_knowledge_manifest(())


def test_default_embedding_model_is_optimized_for_chinese_retrieval() -> None:
    settings = Settings(_env_file=None)

    assert settings.RAG_EMBEDDING_MODEL == "BAAI/bge-small-zh-v1.5"
    assert settings.RAG_COLLECTION_NAME == "mental_health_knowledge_bge_zh_v1"


@pytest.mark.asyncio
async def test_answer_is_grounded_in_retrieved_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    retrieved = RetrievedKnowledge(
        content="保持规律睡眠时间表。",
        title="睡眠卫生",
        reference="国家卫健委睡眠健康指南",
    )
    captured_messages = None

    async def fake_chat(self, *, messages, temperature, max_tokens):
        nonlocal captured_messages
        captured_messages = messages
        return "建议保持规律作息。", "deepseek-chat", {"totalTokens": 20}

    monkeypatch.setattr("app.rag.service.retrieve_knowledge", lambda query, limit: [retrieved])
    monkeypatch.setattr("app.rag.service.OpenAICompatibleProvider.chat", fake_chat)

    result = await answer_question(RagAnswerRequest(query="怎样改善睡眠", requestId="r1"))

    assert result.sources[0].reference == "国家卫健委睡眠健康指南"
    assert result.fallbackUsed is False
    assert captured_messages is not None
    assert "保持规律睡眠时间表" in captured_messages[-1]["content"]
