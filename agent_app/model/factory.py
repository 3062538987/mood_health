"""
模型工厂 — 统一实例化 ChatModel 和 Embedding 模型。
ChatModel 指向 DeepSeek API（兼容 OpenAI 接口），
Embedding 使用 HuggingFace 的 all-MiniLM-L6-v2（轻量，~80MB）。
"""

from langchain_openai import ChatOpenAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from utils.config import get_config


def create_chat_model(temperature: float = 0.7) -> ChatOpenAI:
    """
    创建 ChatOpenAI 实例，指向 DeepSeek API。

    Args:
        temperature: 温度参数，控制输出随机性，默认 0.7

    Returns:
        配置好的 ChatOpenAI 实例
    """
    config = get_config()
    return ChatOpenAI(
        model=config.AI_MODEL,
        api_key=config.AI_API_KEY,
        base_url=config.AI_BASE_URL,
        temperature=temperature,
        max_tokens=2048,
    )


def create_embedding_model() -> HuggingFaceEmbeddings:
    """
    创建 HuggingFace 嵌入模型实例。

    使用 all-MiniLM-L6-v2：
    - 模型大小约 80MB，适合 2核2G 服务器
    - 输出维度 384，检索速度快
    - 首次使用自动下载，之后缓存复用

    Returns:
        配置好的 HuggingFaceEmbeddings 实例
    """
    return HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )