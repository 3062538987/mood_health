"""
Streamlit 可视化界面 — Agent 智能对话系统主入口。

双栏布局：左侧对话区（60%），右侧思维链展示区（40%）。
从 URL 参数读取 user_id，实现跨会话记忆。
"""

import sys
import os

# 确保 agent_app 在 Python 路径中
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st
from langchain_core.messages import HumanMessage, AIMessage

from agent.react_agent import run_agent_stream, reset_agent
from db.conversation_store import (
    save_message,
    load_history,
    clear_history,
)
from rag.rag_service import init_knowledge_base
from utils.logger import setup_logger, get_logger
from utils.config import get_config

# 初始化日志
setup_logger()
logger = get_logger(__name__)

# 页面配置
st.set_page_config(
    page_title="AI 心理健康知识助手",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# 自定义 CSS 样式
st.markdown("""
<style>
    .chat-bubble-user {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 18px 18px 4px 18px;
        margin: 8px 0;
        max-width: 80%;
        float: right;
        clear: both;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
    .chat-bubble-assistant {
        background: #f0f2f6;
        color: #1a1a2e;
        padding: 12px 16px;
        border-radius: 18px 18px 18px 4px;
        margin: 8px 0;
        max-width: 80%;
        float: left;
        clear: both;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .step-container {
        border-left: 3px solid #667eea;
        padding: 8px 12px;
        margin: 6px 0;
        background: #f8f9ff;
        border-radius: 0 8px 8px 0;
    }
    .step-thought {
        border-left-color: #ffa726;
    }
    .step-action {
        border-left-color: #667eea;
    }
    .step-observation {
        border-left-color: #66bb6a;
    }
    .stChatMessage {
        border-radius: 12px !important;
    }
</style>
""", unsafe_allow_html=True)


def get_user_id() -> int:
    """从 URL 参数获取 user_id，默认返回 1"""
    params = st.query_params
    user_id_str = params.get("user_id", "1")
    try:
        return int(user_id_str)
    except ValueError:
        return 1


def init_session_state():
    """初始化 Session State"""
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "initialized" not in st.session_state:
        st.session_state.initialized = False


def load_chat_history(user_id: int):
    """从 MySQL 加载历史对话"""
    if st.session_state.initialized:
        return
    history = load_history(user_id)
    for msg in history:
        st.session_state.messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })
    st.session_state.initialized = True
    if history:
        logger.info("已加载用户 %s 的 %d 条历史对话", user_id, len(history))


def clear_chat(user_id: int):
    """清空对话"""
    clear_history(user_id)
    st.session_state.messages = []
    reset_agent()
    st.rerun()


def render_chat_bubble(role: str, content: str):
    """渲染对话气泡"""
    if role == "user":
        st.markdown(
            f'<div class="chat-bubble-user">{content}</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f'<div class="chat-bubble-assistant">{content}</div>',
            unsafe_allow_html=True,
        )


def render_cot_steps(steps: list[dict]):
    """渲染思维链步骤"""
    if not steps:
        st.info("本轮对话无需工具调用，Agent 直接回复。")
        return

    for i, step in enumerate(steps):
        step_type = step.get("type", "")
        with st.expander(f"步骤 {i+1}: {step.get('tool', '思考')}", expanded=True):
            if step_type == "action":
                st.markdown("**🔍 工具调用 (Action)**")
                st.code(f"工具: {step.get('tool', '')}\n参数: {step.get('tool_input', '')}")
                if "observation" in step:
                    st.markdown("**📋 观察结果 (Observation)**")
                    st.text(step["observation"][:1000])
                if "elapsed" in step:
                    st.caption(f"耗时: {step['elapsed']}")
                if "error" in step:
                    st.error(f"错误: {step['error']}")


def main():
    """主函数"""
    user_id = get_user_id()
    init_session_state()
    load_chat_history(user_id)

    # 标题栏
    col_title, col_clear = st.columns([5, 1])
    with col_title:
        st.title("🧠 AI 心理健康知识助手")
        st.caption(f"当前用户 ID: {user_id} | 基于 DeepSeek + LangChain Agent")
    with col_clear:
        if st.button("🗑 清空对话", use_container_width=True):
            clear_chat(user_id)

    # 初始化知识库
    with st.spinner("正在加载心理健康知识库..."):
        init_knowledge_base()

    # 双栏布局
    col_chat, col_cot = st.columns([6, 4])

    # 左侧：对话区
    with col_chat:
        st.subheader("💬 对话")
        chat_container = st.container()
        with chat_container:
            for msg in st.session_state.messages:
                render_chat_bubble(msg["role"], msg["content"])

        # 输入框
        if prompt := st.chat_input("请输入你的问题，例如：如何缓解焦虑？"):
            # 保存用户消息
            st.session_state.messages.append({"role": "user", "content": prompt})
            save_message(user_id, "user", prompt)
            render_chat_bubble("user", prompt)

            # 构建 LangChain 消息历史
            lc_history = []
            for msg in st.session_state.messages[:-1]:  # 不含刚发送的
                if msg["role"] == "user":
                    lc_history.append(HumanMessage(content=msg["content"]))
                else:
                    lc_history.append(AIMessage(content=msg["content"]))

            # 执行 Agent
            with st.spinner("Agent 正在思考..."):
                all_steps = []
                final_answer = ""
                for item in run_agent_stream(prompt, lc_history):
                    if item["type"] == "step":
                        all_steps.append(item["data"])
                    elif item["type"] == "final":
                        final_answer = item["data"]
                    elif item["type"] == "error":
                        final_answer = item["data"]

            # 保存并显示助手回复
            if final_answer:
                st.session_state.messages.append({"role": "assistant", "content": final_answer})
                save_message(user_id, "assistant", final_answer)
                render_chat_bubble("assistant", final_answer)
            else:
                st.error("未收到 Agent 回复")

            # 存储思维链步骤到 session
            st.session_state.last_cot_steps = all_steps

    # 右侧：思维链区
    with col_cot:
        st.subheader("🔗 思维链 (Chain of Thought)")
        if "last_cot_steps" in st.session_state and st.session_state.last_cot_steps:
            render_cot_steps(st.session_state.last_cot_steps)
        else:
            st.info("发送一条消息后，Agent 的推理过程将在此展示。")

    # 侧边栏：信息
    with st.sidebar:
        st.markdown("### 📊 系统信息")
        config = get_config()
        st.markdown(f"- 模型: {config.AI_MODEL}")
        st.markdown(f"- 最大迭代: {config.MAX_ITERATIONS}")
        st.markdown(f"- 摘要触发轮数: {config.SUMMARY_TRIGGER_ROUNDS}")
        st.markdown(f"- 保留最近轮数: {config.KEEP_RECENT_ROUNDS}")

        msg_count = len(st.session_state.messages)
        st.markdown(f"- 当前对话轮数: {msg_count // 2}")

        if msg_count >= config.SUMMARY_TRIGGER_ROUNDS * 2:
            st.warning("对话轮数已达上限，早期对话将被压缩为摘要。")

        st.markdown("---")
        st.markdown("### 🛠 可用工具")
        st.markdown("- 📚 local_knowledge_search")
        st.markdown("- 🌐 web_search")
        st.markdown("- 🕐 get_current_time")


if __name__ == "__main__":
    main()