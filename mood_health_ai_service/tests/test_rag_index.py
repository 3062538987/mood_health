from __future__ import annotations

import threading
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.rag import retriever
from app.rag.knowledge_base import KNOWLEDGE_MANIFEST, KnowledgeRecord


class Encoded:
    def __init__(self, rows: int, value: float = 0.1) -> None:
        self.rows = rows
        self.value = value

    def tolist(self) -> list[list[float]]:
        return [[self.value]] * self.rows


class FakeEmbeddingModel:
    def __init__(self, *, fail: bool = False) -> None:
        self.calls = 0
        self.fail = fail

    def encode(self, documents: list[str], *, normalize_embeddings: bool) -> Encoded:
        assert normalize_embeddings is True
        self.calls += 1
        if self.fail:
            raise RuntimeError("encode failed")
        return Encoded(len(documents))


class FakeCollection:
    def __init__(
        self,
        name: str,
        metadata: dict[str, Any],
        *,
        count: int = 0,
        fail_add: bool = False,
        fail_modify: bool = False,
        fail_ready_count: bool = False,
        expected_query_embedding: list[list[float]] | None = None,
    ) -> None:
        self.name = name
        self.metadata = metadata
        self._count = count
        self.fail_add = fail_add
        self.fail_modify = fail_modify
        self.fail_ready_count = fail_ready_count
        self.expected_query_embedding = expected_query_embedding
        self.add_calls = 0
        self.modify_calls = 0
        self.added: dict[str, Any] | None = None
        self.configuration = {"hnsw": {"space": "cosine"}}

    def query(self, **kwargs: Any) -> dict[str, list[list[Any]]]:
        if self.expected_query_embedding is not None:
            assert kwargs["query_embeddings"] == self.expected_query_embedding
        return {
            "documents": [["still queryable"]],
            "metadatas": [[{"title": "old", "reference": "old"}]],
            "distances": [[0.0]],
        }

    def count(self) -> int:
        if self.fail_ready_count and self.metadata.get("index_state") == "ready":
            raise RuntimeError("post-ready verification failed")
        return self._count

    def add(self, **kwargs: Any) -> None:
        self.add_calls += 1
        if self.fail_add:
            raise RuntimeError("add failed")
        self.added = kwargs
        self._count += len(kwargs["ids"])

    def modify(self, *, metadata: dict[str, Any]) -> None:
        self.modify_calls += 1
        if self.fail_modify:
            raise RuntimeError("modify failed")
        self.metadata = metadata


class FakeClient:
    def __init__(self, collections: list[FakeCollection] | None = None) -> None:
        self.collections = {collection.name: collection for collection in collections or []}
        self.deleted: list[str] = []
        self.created: list[FakeCollection] = []
        self.create_options: dict[str, Any] | None = None
        self.created_fail_add = False
        self.created_fail_modify = False
        self.created_fail_ready_count = False

    def list_collections(self) -> list[FakeCollection]:
        return list(self.collections.values())

    def get_collection(self, *, name: str) -> FakeCollection:
        return self.collections[name]

    def create_collection(self, *, name: str, metadata: dict[str, Any]) -> FakeCollection:
        self.create_options = {"name": name, "metadata": metadata}
        collection = FakeCollection(
            name,
            dict(metadata),
            fail_add=self.created_fail_add,
            fail_modify=self.created_fail_modify,
            fail_ready_count=self.created_fail_ready_count,
        )
        self.collections[name] = collection
        self.created.append(collection)
        return collection

    def delete_collection(self, *, name: str) -> None:
        self.deleted.append(name)
        del self.collections[name]

    def get_or_create_collection(self, **kwargs: Any) -> None:
        raise AssertionError("get_or_create_collection must not be used")


@pytest.fixture(autouse=True)
def reset_retriever(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = SimpleNamespace(
        RAG_COLLECTION_NAME="mental-health-knowledge",
        RAG_EMBEDDING_MODEL="test-embedding-model",
        RAG_PERSIST_DIRECTORY="unused-in-tests",
        RAG_TOP_K=3,
    )
    monkeypatch.setattr(retriever, "get_settings", lambda: settings)
    monkeypatch.setattr(retriever, "_client", None)
    monkeypatch.setattr(retriever, "_live_state", None)


def _expected_metadata(*, state: str = "ready") -> dict[str, Any]:
    metadata = {
        "manifest_version": retriever.calculate_manifest_version(KNOWLEDGE_MANIFEST),
        "manifest_count": len(KNOWLEDGE_MANIFEST),
        "index_state": state,
        "embedding_model": "test-embedding-model",
    }
    if state == "building":
        metadata["hnsw:space"] = "cosine"
    return metadata


def _versioned_name(embedding_model: str = "test-embedding-model") -> str:
    version = retriever.calculate_manifest_version(KNOWLEDGE_MANIFEST)
    model_version = retriever.calculate_embedding_model_version(embedding_model)
    return f"mental-health-knowledge-{version[:12]}-{model_version[:12]}"


def _live_state(
    collection: FakeCollection,
    embedding_model: Any | None = None,
    embedding_model_name: str = "test-embedding-model",
) -> retriever.LiveRetrieverState:
    return retriever.LiveRetrieverState(
        collection=collection,
        embedding_model=(
            embedding_model if embedding_model is not None else FakeEmbeddingModel()
        ),
        embedding_model_name=embedding_model_name,
    )


def test_manifest_hash_is_reorder_stable_and_canonicalizes_text() -> None:
    first = KnowledgeRecord(
        "first",
        "Caf\u00e9",
        "line 1\r\nline 2",
        "ref",
        "https://a.test",
        "2026-08-09",
    )
    second = KnowledgeRecord(
        "second", "title", "content", "ref", "https://b.test", "2026-08-09"
    )
    normalized = replace(first, title="Cafe\u0301", content="line 1\nline 2")

    expected = retriever.calculate_manifest_version((first, second))

    assert retriever.calculate_manifest_version((second, first)) == expected
    assert retriever.calculate_manifest_version((normalized, second)) == expected


def test_manifest_hash_sorts_after_normalizing_combining_ids() -> None:
    composed = KnowledgeRecord(
        "\u00e9", "a", "alpha", "ref", "https://a.test", "2026-08-09"
    )
    decomposed = KnowledgeRecord(
        "e\u0301", "b", "beta", "ref", "https://b.test", "2026-08-09"
    )
    normalized_ids = (replace(composed, id="\u00e9"), replace(decomposed, id="\u00e9"))

    assert retriever.calculate_manifest_version(
        (composed, decomposed)
    ) == retriever.calculate_manifest_version(normalized_ids)


def test_collection_identity_changes_with_embedding_model() -> None:
    assert _versioned_name("model-a") != _versioned_name("model-b")


def test_embedding_model_loader_uses_explicit_requested_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loaded: list[str] = []

    class FakeSentenceTransformer:
        def __init__(self, model_name: str) -> None:
            loaded.append(model_name)

    monkeypatch.setattr(
        retriever,
        "import_module",
        lambda name: SimpleNamespace(SentenceTransformer=FakeSentenceTransformer),
    )

    first = retriever._load_embedding_model("test-embedding-model")
    second = retriever._load_embedding_model("replacement-model")

    assert first is not second
    assert loaded == ["test-embedding-model", "replacement-model"]


def test_live_state_rejects_missing_embedding_model_name() -> None:
    with pytest.raises((TypeError, ValueError)):
        retriever.LiveRetrieverState(  # type: ignore[arg-type]
            collection=object(), embedding_model=object(), embedding_model_name=None
        )


def test_unknown_cached_model_without_name_is_discarded_and_reloaded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing = FakeCollection(
        _versioned_name(), _expected_metadata(), count=len(KNOWLEDGE_MANIFEST)
    )
    client = FakeClient([existing])
    unknown_model = FakeEmbeddingModel()
    replacement_model = FakeEmbeddingModel()
    loaded: list[str] = []
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(
        retriever,
        "_live_state",
        SimpleNamespace(
            collection=existing,
            embedding_model=unknown_model,
            embedding_model_name=None,
        ),
    )

    def load(model_name: str) -> FakeEmbeddingModel:
        loaded.append(model_name)
        return replacement_model

    monkeypatch.setattr(retriever, "_load_embedding_model", load)

    retriever.initialize_retriever()

    assert loaded == ["test-embedding-model"]
    assert isinstance(retriever._live_state, retriever.LiveRetrieverState)
    assert retriever._live_state.embedding_model is replacement_model


def test_search_snapshots_matching_model_and_collection_during_rebuild(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = retriever.get_settings()
    old_model = FakeEmbeddingModel()
    old_collection = FakeCollection(
        _versioned_name(),
        _expected_metadata(),
        count=len(KNOWLEDGE_MANIFEST),
        expected_query_embedding=[[0.1]],
    )
    client = FakeClient([old_collection])
    build_started = threading.Event()
    release_build = threading.Event()

    class BlockingReplacementModel:
        def encode(
            self, documents: list[str], *, normalize_embeddings: bool
        ) -> Encoded:
            assert normalize_embeddings is True
            if documents == [record.content for record in KNOWLEDGE_MANIFEST]:
                build_started.set()
                assert release_build.wait(timeout=5)
            return Encoded(len(documents), value=0.9)

    replacement_model = BlockingReplacementModel()
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(
        retriever,
        "_live_state",
        _live_state(old_collection, old_model, settings.RAG_EMBEDDING_MODEL),
    )
    monkeypatch.setattr(retriever, "_load_embedding_model", lambda name: replacement_model)
    settings.RAG_EMBEDDING_MODEL = "replacement-model"
    build_errors: list[BaseException] = []

    def rebuild() -> None:
        try:
            retriever.initialize_retriever()
        except BaseException as error:
            build_errors.append(error)

    builder = threading.Thread(target=rebuild)
    builder.start()
    assert build_started.wait(timeout=5)
    try:
        results = retriever._similarity_search("query during rebuild", 1)
    finally:
        release_build.set()
        builder.join(timeout=5)

    assert builder.is_alive() is False
    assert build_errors == []
    assert results[0].content == "still queryable"
    assert retriever._live_state is not None
    assert retriever._live_state.embedding_model is replacement_model
    assert retriever._live_state.collection is client.created[0]


@pytest.mark.parametrize("field_name", ["id", "title", "content", "reference", "url", "reviewedAt"])
def test_manifest_hash_changes_when_any_contract_field_changes(field_name: str) -> None:
    original = KNOWLEDGE_MANIFEST[0]
    changed = replace(original, **{field_name: getattr(original, field_name) + "x"})

    assert retriever.calculate_manifest_version(
        (changed,)
    ) != retriever.calculate_manifest_version((original,))


def test_manifest_hash_rejects_non_record_values() -> None:
    with pytest.raises(TypeError, match="KnowledgeRecord"):
        retriever.calculate_manifest_version(({"id": "bypass"},))  # type: ignore[arg-type]


def test_exact_ready_collection_is_reused_without_encoding_or_adding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing = FakeCollection(
        _versioned_name(), _expected_metadata(), count=len(KNOWLEDGE_MANIFEST)
    )
    client = FakeClient([existing])
    embedding = FakeEmbeddingModel()
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(retriever, "_load_embedding_model", lambda name: embedding)

    retriever.initialize_retriever()

    assert retriever._live_state is not None
    assert retriever._live_state.collection is existing
    assert retriever._live_state.embedding_model is embedding
    assert embedding.calls == 0
    assert existing.add_calls == 0
    assert client.created == []


@pytest.mark.parametrize(
    ("metadata_change", "row_delta"),
    [
        ({"manifest_version": "wrong"}, 0),
        ({"embedding_model": "wrong"}, 0),
        ({"manifest_count": 999}, 0),
        ({"index_state": "building"}, 0),
        ({}, -1),
        ({}, 1),
    ],
)
def test_mismatched_candidate_is_deleted_and_rebuilt(
    monkeypatch: pytest.MonkeyPatch,
    metadata_change: dict[str, Any],
    row_delta: int,
) -> None:
    metadata = _expected_metadata()
    metadata.update(metadata_change)
    stale = FakeCollection(
        _versioned_name(),
        metadata,
        count=len(KNOWLEDGE_MANIFEST) + row_delta,
    )
    client = FakeClient([stale])
    embedding = FakeEmbeddingModel()
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(retriever, "_load_embedding_model", lambda name: embedding)

    retriever.initialize_retriever()

    assert client.deleted == [_versioned_name()]
    assert len(client.created) == 1
    assert embedding.calls == 1
    assert retriever._live_state is not None
    assert retriever._live_state.collection is client.created[0]
    assert client.created[0].metadata == _expected_metadata()
    assert client.created[0].count() == len(KNOWLEDGE_MANIFEST)
    assert client.created[0].added is not None
    assert client.created[0].added["ids"] == [record.id for record in KNOWLEDGE_MANIFEST]


@pytest.mark.parametrize("failure", ["encode", "add", "modify", "verify"])
def test_model_rebuild_failure_preserves_registered_queryable_live_collection(
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    settings = retriever.get_settings()
    old_model = settings.RAG_EMBEDDING_MODEL
    prior = FakeCollection(
        _versioned_name(old_model), _expected_metadata(), count=len(KNOWLEDGE_MANIFEST)
    )
    client = FakeClient([prior])
    embedding = FakeEmbeddingModel(fail=failure == "encode")
    client.created_fail_add = failure == "add"
    client.created_fail_modify = failure == "modify"
    client.created_fail_ready_count = failure == "verify"
    monkeypatch.setattr(retriever, "_client", client)
    prior_state = _live_state(prior, FakeEmbeddingModel(), old_model)
    monkeypatch.setattr(retriever, "_live_state", prior_state)
    monkeypatch.setattr(retriever, "_load_embedding_model", lambda name: embedding)
    settings.RAG_EMBEDDING_MODEL = "replacement-model"

    with pytest.raises(RuntimeError):
        retriever.initialize_retriever()

    assert retriever._live_state is prior_state
    assert prior.name in client.collections
    settings.RAG_EMBEDDING_MODEL = old_model
    assert retriever.verify_retriever_ready() is True
    assert retriever._similarity_search("still available", 1)[0].content == "still queryable"


@pytest.mark.parametrize(
    ("metadata_space", "configuration_space"),
    [("cosine", "l2"), ("l2", "cosine")],
)
def test_cosine_metadata_and_configuration_must_both_agree(
    monkeypatch: pytest.MonkeyPatch,
    metadata_space: str,
    configuration_space: str,
) -> None:
    live = FakeCollection(
        _versioned_name(),
        {**_expected_metadata(), "hnsw:space": metadata_space},
        count=len(KNOWLEDGE_MANIFEST),
    )
    live.configuration = {"hnsw": {"space": configuration_space}}
    monkeypatch.setattr(retriever, "_live_state", _live_state(live))

    assert retriever.verify_retriever_ready() is False


def test_building_candidate_is_rebuilt_on_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    building = FakeCollection(
        _versioned_name(),
        _expected_metadata(state="building"),
        count=1,
    )
    client = FakeClient([building])
    monkeypatch.setattr(retriever, "_client", client)
    embedding = FakeEmbeddingModel()
    monkeypatch.setattr(retriever, "_load_embedding_model", lambda name: embedding)

    retriever.initialize_retriever()

    assert client.deleted == [_versioned_name()]
    assert retriever._live_state is not None
    assert retriever._live_state.collection is client.created[0]
    assert retriever.verify_retriever_ready() is True


def test_older_ready_collection_is_retained_for_rollback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    older = FakeCollection(
        "mental-health-knowledge-000000000000",
        {**_expected_metadata(), "manifest_version": "0" * 64},
        count=len(KNOWLEDGE_MANIFEST),
    )
    client = FakeClient([older])
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(
        retriever, "_load_embedding_model", lambda name: FakeEmbeddingModel()
    )

    retriever.initialize_retriever()

    assert older.name in client.collections
    assert client.deleted == []


def test_real_chroma_159_supports_building_to_ready_transition(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import chromadb

    assert chromadb.__version__ == "1.5.9"
    client = chromadb.PersistentClient(path=str(tmp_path / "chroma"))
    monkeypatch.setattr(retriever, "_client", client)
    monkeypatch.setattr(
        retriever, "_load_embedding_model", lambda name: FakeEmbeddingModel()
    )

    retriever.initialize_retriever()

    assert retriever.verify_retriever_ready() is True
    collection = client.get_collection(name=_versioned_name())
    assert collection.metadata == _expected_metadata()
    assert collection.configuration["hnsw"]["space"] == "cosine"
    client.delete_collection(name=_versioned_name())
    assert client.list_collections() == []


@pytest.mark.parametrize(
    ("metadata_change", "count_delta"),
    [
        ({"manifest_version": "wrong"}, 0),
        ({"manifest_count": 999}, 0),
        ({"embedding_model": "wrong"}, 0),
        ({"index_state": "building"}, 0),
        ({"manifest_version": None}, 0),
        ({}, -1),
        ({}, 1),
    ],
)
def test_live_verifier_requires_exact_current_metadata_and_count(
    monkeypatch: pytest.MonkeyPatch,
    metadata_change: dict[str, Any],
    count_delta: int,
) -> None:
    metadata = _expected_metadata()
    for key, value in metadata_change.items():
        if value is None:
            metadata.pop(key)
        else:
            metadata[key] = value
    live = FakeCollection(_versioned_name(), metadata, count=len(KNOWLEDGE_MANIFEST) + count_delta)
    monkeypatch.setattr(retriever, "_live_state", _live_state(live))

    assert retriever.verify_retriever_ready() is False


def test_live_verifier_is_side_effect_free_and_true_only_for_exact_live_pointer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert retriever.verify_retriever_ready() is False
    assert retriever._client is None
    assert retriever._live_state is None

    live = FakeCollection(_versioned_name(), _expected_metadata(), count=len(KNOWLEDGE_MANIFEST))
    monkeypatch.setattr(retriever, "_live_state", _live_state(live))
    assert retriever.verify_retriever_ready() is True


def test_runtime_app_is_decoupled_from_legacy_agent_app() -> None:
    app_root = Path(__file__).parents[1] / "app"
    forbidden = "agent" + "_app"

    for source_path in app_root.rglob("*.py"):
        assert forbidden not in source_path.read_text(encoding="utf-8"), source_path
