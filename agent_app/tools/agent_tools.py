"""
领域工具集 — 统一注册并暴露所有 Agent 可用工具。
每个工具使用 @tool 装饰器，包含详尽的 description 防止模型幻觉。

工具列表：
1. local_knowledge_search — 检索本地心理健康知识库
2. web_search — DuckDuckGo 网络搜索
3. get_current_time — 获取当前时间
"""

from langchain.tools import tool
from datetime import datetime


@tool
def web_search(query: str) -> str:
    """
    使用 DuckDuckGo 搜索引擎搜索网络信息。

    适用场景（应该调用）：
    - 用户需要最新的心理学研究、新闻或外部资源
    - 用户询问心理热线、专业机构等外部信息
    - 本地知识库无法覆盖的问题

    不适用场景（不应该调用）：
    - 用户只是闲聊或表达情绪（直接回复即可）
    - 本地知识库已有充分覆盖的知识（优先用 local_knowledge_search）

    Args:
        query: 搜索关键词，建议使用简洁的搜索词（如"焦虑症 最新研究 2024"）

    Returns:
        搜索结果摘要，包含标题和链接
    """
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=5):
                results.append(f"- {r['title']}: {r['body'][:200]}\n  {r['href']}")
        if not results:
            return f"未找到与「{query}」相关的搜索结果。"
        return f"搜索「{query}」的结果：\n\n" + "\n\n".join(results)
    except ImportError:
        return "网络搜索功能未安装 duckduckgo-search 库，请先安装：pip install duckduckgo-search"
    except Exception as e:
        return f"网络搜索失败：{str(e)}。请稍后重试或换个搜索词。"


@tool
def get_current_time() -> str:
    """
    获取当前日期和时间。

    适用场景（应该调用）：
    - 用户询问当前时间、日期、星期几
    - 需要根据当前时间来推荐合适的活动或建议
    - 判断现在是白天还是深夜，给出时段匹配的回复

    不适用场景（不应该调用）：
    - 用户问的是"昨天"、"明天"等相对时间概念（直接推理即可，不需要调用工具）
    - 纯粹的知识问答

    Returns:
        当前日期时间字符串，格式如"2026年7月19日 星期日 14:30:25"
    """
    now = datetime.now()
    weekdays = ["一", "二", "三", "四", "五", "六", "日"]
    weekday = weekdays[now.weekday()]
    return f"{now.year}年{now.month}月{now.day}日 星期{weekday} {now.hour:02d}:{now.minute:02d}:{now.second:02d}"


def get_all_tools():
    """
    获取所有可用工具的列表。

    将 RAG 的 search_knowledge 函数封装为 LangChain Tool，
    与 web_search、get_current_time 一起注册。

    Returns:
        LangChain Tool 列表
    """
    from rag.rag_service import search_knowledge

    # 将 RAG 函数封装为 LangChain Tool
    local_knowledge_search = tool(search_knowledge)
    local_knowledge_search.name = "local_knowledge_search"
    local_knowledge_search.description = """
    检索本地心理健康知识库，获取基于真实心理学文献的专业知识。

    适用场景（应该调用）：
    - 用户询问心理健康专业知识（如"焦虑症有哪些缓解方法"）
    - 用户需要 CBT 技巧、正念练习、情绪调节等专业指导
    - 用户问及抑郁、焦虑、压力、睡眠等心理健康相关话题

    不适用场景（不应该调用）：
    - 用户只是闲聊或表达情绪（直接回复即可）
    - 用户需要最新新闻或外部资源（使用 web_search）
    - 用户问当前时间（使用 get_current_time）
    - 需要计算的问题

    知识库内容来源：WHO 心理健康指南、国家卫健委《心理健康素养十条》、
    中国心理学会科普资料、CBT 经典教材（Beck, 1979）等权威文献。

    Args:
        query: 检索关键词或问题，如"如何缓解焦虑"、"正念练习步骤"

    Returns:
        相关知识片段及来源标注
    """

    return [local_knowledge_search, web_search, get_current_time]