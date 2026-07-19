"""
向量数据库管理 — ChromaDB 内存模式，使用 all-MiniLM-L6-v2 嵌入模型。
进程结束即释放内存，无需持久化，适合 2核2G 服务器。
"""

from langchain_chroma import Chroma
from langchain_core.documents import Document
from model.factory import create_embedding_model

# 全局向量存储实例（懒加载）
_vector_store = None


def get_vector_store(documents: list[Document] = None) -> Chroma:
    """
    获取或创建 ChromaDB 向量存储（内存模式）。

    Args:
        documents: 可选的文档列表，首次调用时传入以创建向量库

    Returns:
        Chroma 向量存储实例
    """
    global _vector_store
    if _vector_store is None:
        embeddings = create_embedding_model()
        if documents:
            _vector_store = Chroma.from_documents(
                documents=documents,
                embedding=embeddings,
                collection_name="mental_health_knowledge",
                persist_directory=None,  # 内存模式，不持久化
            )
        else:
            # 无文档时创建空集合
            _vector_store = Chroma(
                embedding_function=embeddings,
                collection_name="mental_health_knowledge",
                persist_directory=None,
            )
    return _vector_store


def create_retriever(k: int = 3):
    """
    创建检索器。

    Args:
        k: 返回的相关文档数量，默认 3

    Returns:
        Chroma 检索器实例
    """
    store = get_vector_store()
    return store.as_retriever(search_kwargs={"k": k})