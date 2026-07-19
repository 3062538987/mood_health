"""
Agent 核心链 — 使用 LangChain 1.2+ 的 create_react_agent 和 AgentExecutor 构建。
使用 LCEL 语法（| 管道符）串联组件，集成中间件回调、Token 截断和异常恢复。

严禁使用 initialize_agent 等已废弃接口。
"""

from typing import Generator
from langchain.agents import create_react_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from model.factory import create_chat_model
from tools.agent_tools import get_all_tools
from tools.middleware import AgentMiddleware
from utils.config import get_config
from utils.prompt_loader import get_agent_system_prompt
from utils.logger import get_logger

logger = get_logger(__name__)

# 全局 Agent 实例缓存
_agent_executor = None


def _build_agent() -> AgentExecutor:
    """
    构建 AgentExecutor 实例。

    使用 create_react_agent（现代 API）+ LCEL 语法构建。
    配置 handle_parsing_errors=True 和 max_iterations=10 实现异常恢复。

    Returns:
        配置好的 AgentExecutor 实例
    """
    config = get_config()
    llm = create_chat_model()
    tools = get_all_tools()

    # 使用 LCEL 语法构建 ChatPromptTemplate
    prompt = ChatPromptTemplate.from_messages([
        ("system", get_agent_system_prompt()),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # 使用 create_react_agent 创建 Agent（严禁使用 initialize_agent）
    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)

    # 使用 AgentExecutor 包装，配置异常恢复和迭代限制
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        handle_parsing_errors=True,  # 输出解析失败时自动重试
        max_iterations=config.MAX_ITERATIONS,  # 防止死循环
        verbose=False,  # 使用自定义中间件替代 verbose
        return_intermediate_steps=True,  # 返回中间步骤用于思维链展示
    )

    return executor


def get_agent() -> AgentExecutor:
    """获取全局 Agent 实例（懒加载）"""
    global _agent_executor
    if _agent_executor is None:
        _agent_executor = _build_agent()
    return _agent_executor


def _compress_history(chat_history: list) -> list:
    """
    Token 截断策略：当对话历史超过阈值时，压缩早期对话。

    策略：
    - 超过 SUMMARY_TRIGGER_ROUNDS（10轮）时触发
    - 调用 DeepSeek 对前 5 轮对话生成摘要（不超过 200 字）
    - 保留摘要 + 最近 KEEP_RECENT_ROUNDS（5轮）原文

    Args:
        chat_history: 完整的对话历史列表

    Returns:
        压缩后的对话历史列表
    """
    config = get_config()
    if len(chat_history) <= config.SUMMARY_TRIGGER_ROUNDS * 2:
        return chat_history

    # 分离早期对话和近期对话
    early_count = (len(chat_history) - config.KEEP_RECENT_ROUNDS * 2)
    recent = chat_history[-config.KEEP_RECENT_ROUNDS * 2:]

    # 构建早期对话摘要请求
    early_text = ""
    for msg in chat_history[:early_count]:
        role = "用户" if isinstance(msg, HumanMessage) else "助手"
        content = msg.content[:200]
        early_text += f"{role}: {content}\n"

    try:
        llm = create_chat_model(temperature=0.3)
        summary_prompt = (
            f"请将以下对话历史压缩为一段不超过200字的中文摘要：\n\n{early_text}"
        )
        summary_msg = llm.invoke(summary_prompt)
        summary = summary_msg.content.strip()
        logger.info("对话摘要已生成（%d 字）", len(summary))

        return [SystemMessage(content=f"[早期对话摘要] {summary}")] + recent
    except Exception as e:
        logger.warning("对话摘要生成失败: %s，使用截断策略", e)
        return recent


def run_agent_stream(
    query: str,
    chat_history: list = None,
) -> Generator[dict, None, None]:
    """
    流式执行 Agent，逐步返回思维链步骤。

    每当 Agent 完成一个步骤（思考/工具调用/观察），
    就通过 Generator yield 出去，供 Streamlit 前端实时展示。

    Args:
        query: 用户输入的问题
        chat_history: 历史对话列表（LangChain Message 格式），可为 None

    Yields:
        包含步骤信息的字典：{"type": "step", "data": dict} 或 {"type": "final", "data": str}
    """
    if chat_history is None:
        chat_history = []

    # Token 截断
    chat_history = _compress_history(chat_history)

    # 创建中间件实例
    middleware = AgentMiddleware()

    try:
        agent = get_agent()
        result = agent.invoke(
            {"input": query, "chat_history": chat_history},
            config={"callbacks": [middleware]},
        )

        # 逐步骤 yield 中间步骤
        for step in middleware.get_steps():
            yield {"type": "step", "data": step}

        # yield 最终答案
        output = result.get("output", "抱歉，我无法回答这个问题。")
        yield {"type": "final", "data": output}

    except Exception as e:
        logger.error("Agent 执行失败: %s", e)
        yield {"type": "error", "data": f"Agent 执行出错：{str(e)}。请稍后重试。"}


def run_agent(query: str, chat_history: list = None) -> dict:
    """
    同步执行 Agent，返回完整结果（包含中间步骤和最终答案）。

    Args:
        query: 用户输入的问题
        chat_history: 历史对话列表

    Returns:
        {"steps": list[dict], "answer": str}
    """
    result = {"steps": [], "answer": ""}
    for item in run_agent_stream(query, chat_history):
        if item["type"] == "step":
            result["steps"].append(item["data"])
        elif item["type"] == "final":
            result["answer"] = item["data"]
        elif item["type"] == "error":
            result["answer"] = item["data"]
    return result


def reset_agent():
    """重置 Agent 实例（清空缓存）"""
    global _agent_executor
    _agent_executor = None
    logger.info("Agent 实例已重置")