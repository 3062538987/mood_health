"""Persistent, versioned vector retrieval for the audited knowledge manifest."""

from __future__ import annotations

import hashlib
import json
import threading
import unicodedata
from dataclasses import dataclass
from importlib import import_module
from typing import Any

from app.config import get_settings
from app.rag.knowledge_base import KNOWLEDGE_MANIFEST, KnowledgeRecord

_MANIFEST_FIELDS = ("id", "title", "content", "reference", "url", "reviewedAt")
_COLLECTION_NAME_LIMIT = 512


@dataclass(frozen=True)
class RetrievedKnowledge:
    content: str
    title: str
    reference: str
    similarity: float = 1.0


@dataclass(frozen=True)
class LiveRetrieverState:
    """One atomically published embedding-space snapshot."""

    collection: Any
    embedding_model: Any
    embedding_model_name: str

    def __post_init__(self) -> None:
        if not isinstance(self.embedding_model_name, str) or not self.embedding_model_name:
            raise ValueError("live retriever state requires an embedding model name")


_client: Any | None = None
_live_state: LiveRetrieverState | None = None
_initialize_lock = threading.Lock()


def _canonical_text(value: str) -> str:
    return unicodedata.normalize("NFC", value.replace("\r\n", "\n").replace("\r", "\n"))


def calculate_manifest_version(records: tuple[KnowledgeRecord, ...]) -> str:
    """Return the canonical SHA-256 for an immutable knowledge-record tuple."""
    if not isinstance(records, tuple) or any(
        not isinstance(record, KnowledgeRecord) for record in records
    ):
        raise TypeError("manifest version requires a tuple of KnowledgeRecord values")

    canonical_records: list[dict[str, str]] = [
        {
            field_name: _canonical_text(getattr(record, field_name))
            for field_name in _MANIFEST_FIELDS
        }
        for record in records
    ]
    canonical_records.sort(
        key=lambda record: tuple(record[field_name] for field_name in _MANIFEST_FIELDS)
    )
    payload = json.dumps(
        canonical_records,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def calculate_embedding_model_version(embedding_model: str) -> str:
    """Return a stable identifier for the configured embedding model."""
    if not isinstance(embedding_model, str):
        raise TypeError("embedding model must be a string")
    canonical_model = _canonical_text(embedding_model)
    return hashlib.sha256(canonical_model.encode("utf-8")).hexdigest()


def _versioned_collection_name(
    base_name: str,
    manifest_version: str,
    embedding_model_version: str,
) -> str:
    suffix = f"-{manifest_version[:12]}-{embedding_model_version[:12]}"
    bounded_base = base_name[: _COLLECTION_NAME_LIMIT - len(suffix)].rstrip("-._")
    if not bounded_base or not bounded_base[0].isalnum():
        raise ValueError("RAG collection base name must start with an alphanumeric character")
    return f"{bounded_base}{suffix}"


def _index_metadata(
    *,
    manifest_version: str,
    manifest_count: int,
    embedding_model: str,
    state: str,
    include_distance_space: bool,
) -> dict[str, str | int]:
    metadata: dict[str, str | int] = {
        "manifest_version": manifest_version,
        "manifest_count": manifest_count,
        "index_state": state,
        "embedding_model": embedding_model,
    }
    if include_distance_space:
        metadata["hnsw:space"] = "cosine"
    return metadata


def _uses_cosine_distance(collection: Any, metadata: dict[str, Any]) -> bool:
    # Chroma 1.5.9 forbids hnsw:space in Collection.modify, even when its
    # value is unchanged, and metadata replacement drops omitted keys. The
    # persisted collection configuration is therefore authoritative after the
    # building -> ready metadata transition.
    configuration = collection.configuration
    if not isinstance(configuration, dict):
        return False
    hnsw_configuration = configuration.get("hnsw")
    if not isinstance(hnsw_configuration, dict):
        return False
    distance_space = hnsw_configuration.get("space")
    if not isinstance(distance_space, str) or distance_space != "cosine":
        return False

    metadata_space = metadata.get("hnsw:space")
    if metadata_space is not None:
        return isinstance(metadata_space, str) and metadata_space == "cosine"
    return True


def _collection_matches(
    collection: Any,
    *,
    manifest_version: str,
    manifest_count: int,
    embedding_model: str,
    state: str,
) -> bool:
    try:
        metadata = collection.metadata
        if not isinstance(metadata, dict):
            return False
        if not _uses_cosine_distance(collection, metadata):
            return False
        if metadata.get("manifest_version") != manifest_version:
            return False
        stored_count = metadata.get("manifest_count")
        if type(stored_count) is not int or stored_count != manifest_count:
            return False
        if metadata.get("index_state") != state:
            return False
        if metadata.get("embedding_model") != embedding_model:
            return False
        return int(collection.count()) == manifest_count
    except Exception:
        return False


def _load_embedding_model(model_name: str) -> Any:
    sentence_transformers = import_module("sentence_transformers")
    sentence_transformer_class = sentence_transformers.SentenceTransformer
    return sentence_transformer_class(model_name)


def _model_for_candidate(
    model_name: str,
    current_state: LiveRetrieverState | None,
) -> Any:
    if current_state is not None and current_state.embedding_model_name == model_name:
        return current_state.embedding_model
    return _load_embedding_model(model_name)


def _get_client() -> Any:
    global _client
    if _client is None:
        settings = get_settings()
        chromadb = import_module("chromadb")
        _client = chromadb.PersistentClient(path=settings.RAG_PERSIST_DIRECTORY)
    return _client


def _find_collection(client: Any, name: str) -> Any | None:
    collection_names = {
        item if isinstance(item, str) else item.name for item in client.list_collections()
    }
    if name not in collection_names:
        return None
    return client.get_collection(name=name)


def _manifest_metadatas() -> list[dict[str, str]]:
    return [
        {
            "id": record.id,
            "title": record.title,
            "content": record.content,
            "reference": record.reference,
            "url": record.url,
            "reviewedAt": record.reviewedAt,
        }
        for record in KNOWLEDGE_MANIFEST
    ]


def initialize_retriever() -> None:
    """Build and atomically publish the current manifest's versioned collection.

    This lock coordinates threads in one process only. The launcher must keep a
    single AI-service worker until cross-process rebuild locking is implemented.
    Older ready collections are intentionally retained as rollback candidates.
    """
    global _live_state

    with _initialize_lock:
        current_state = _live_state
        settings = get_settings()
        manifest_version = calculate_manifest_version(KNOWLEDGE_MANIFEST)
        manifest_count = len(KNOWLEDGE_MANIFEST)
        embedding_model = settings.RAG_EMBEDDING_MODEL
        embedding_model_version = calculate_embedding_model_version(embedding_model)
        collection_name = _versioned_collection_name(
            settings.RAG_COLLECTION_NAME,
            manifest_version,
            embedding_model_version,
        )
        candidate_model = _model_for_candidate(embedding_model, current_state)
        client = _get_client()
        candidate = _find_collection(client, collection_name)

        if candidate is not None and _collection_matches(
            candidate,
            manifest_version=manifest_version,
            manifest_count=manifest_count,
            embedding_model=embedding_model,
            state="ready",
        ):
            _live_state = LiveRetrieverState(
                collection=candidate,
                embedding_model=candidate_model,
                embedding_model_name=embedding_model,
            )
            return

        if candidate is not None:
            client.delete_collection(name=collection_name)

        building_metadata = _index_metadata(
            manifest_version=manifest_version,
            manifest_count=manifest_count,
            embedding_model=embedding_model,
            state="building",
            include_distance_space=True,
        )
        candidate = client.create_collection(
            name=collection_name,
            metadata=building_metadata,
        )

        documents = [record.content for record in KNOWLEDGE_MANIFEST]
        embeddings = candidate_model.encode(
            documents,
            normalize_embeddings=True,
        ).tolist()
        candidate.add(
            ids=[record.id for record in KNOWLEDGE_MANIFEST],
            documents=documents,
            metadatas=_manifest_metadatas(),
            embeddings=embeddings,
        )
        if not _collection_matches(
            candidate,
            manifest_version=manifest_version,
            manifest_count=manifest_count,
            embedding_model=embedding_model,
            state="building",
        ):
            raise RuntimeError("RAG candidate index verification failed")

        ready_metadata = _index_metadata(
            manifest_version=manifest_version,
            manifest_count=manifest_count,
            embedding_model=embedding_model,
            state="ready",
            include_distance_space=False,
        )
        candidate.modify(metadata=ready_metadata)
        if not _collection_matches(
            candidate,
            manifest_version=manifest_version,
            manifest_count=manifest_count,
            embedding_model=embedding_model,
            state="ready",
        ):
            raise RuntimeError("RAG ready index verification failed")

        _live_state = LiveRetrieverState(
            collection=candidate,
            embedding_model=candidate_model,
            embedding_model_name=embedding_model,
        )


def verify_retriever_ready() -> bool:
    """Check the live pointer without initializing any RAG dependency."""
    state = _live_state
    if state is None:
        return False

    try:
        settings = get_settings()
        manifest_version = calculate_manifest_version(KNOWLEDGE_MANIFEST)
        embedding_model = settings.RAG_EMBEDDING_MODEL
        if state.embedding_model_name != embedding_model:
            return False
        expected_name = _versioned_collection_name(
            settings.RAG_COLLECTION_NAME,
            manifest_version,
            calculate_embedding_model_version(embedding_model),
        )
        if state.collection.name != expected_name:
            return False
        return _collection_matches(
            state.collection,
            manifest_version=manifest_version,
            manifest_count=len(KNOWLEDGE_MANIFEST),
            embedding_model=embedding_model,
            state="ready",
        )
    except Exception:
        return False


def _snapshot_live_state() -> LiveRetrieverState:
    state = _live_state
    if state is None:
        initialize_retriever()
        state = _live_state
    if state is None:  # pragma: no cover - defensive guard after initialization
        raise RuntimeError("RAG retriever state was not initialized")
    return state


def _similarity_search(query: str, limit: int) -> list[RetrievedKnowledge]:
    state = _snapshot_live_state()
    query_embedding = state.embedding_model.encode(
        [query],
        normalize_embeddings=True,
    ).tolist()
    result = state.collection.query(
        query_embeddings=query_embedding,
        n_results=limit,
        include=["documents", "metadatas", "distances"],
    )
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    return [
        RetrievedKnowledge(
            content=document,
            title=str(metadata.get("title", "心理健康知识")),
            reference=str(metadata.get("reference", "未知来源")),
            similarity=max(-1.0, min(1.0, 1.0 - float(distance))),
        )
        for document, metadata, distance in zip(documents, metadatas, distances, strict=True)
    ]


def retrieve_knowledge(query: str, limit: int) -> list[RetrievedKnowledge]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    settings = get_settings()
    normalized_limit = max(1, min(limit, settings.RAG_TOP_K))
    return _similarity_search(normalized_query, normalized_limit)
