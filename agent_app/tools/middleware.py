"""
Agent 中间件 — 日志埋点、过程监控回调。
在 Agent 执行过程中记录每一步的 Thought/Action/Observation，
包含时间戳与调用顺序，便于调试和回溯。
"""

import time
from typing import Any
from langchain.callbacks.base import BaseCallbackHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class AgentMiddleware(BaseCallbackHandler):
    """
    Agent 执行过程监控回调。

    记录每一步的：
    - Reasoning（模型思考）：何时开始推理、结束推理
    - Action & Action Input（工具名称与参数）：调用了哪个工具、传了什么参数
    - Observation（工具返回结果）：工具返回了什么内容
    """

    def __init__(self):
        super().__init__()
        self.steps: list[dict] = []  # 存储所有步骤记录
        self._step_start = 0.0
        self._current_tool = ""

    def on_agent_action(self, action: Any, **kwargs: Any) -> None:
        """当 Agent 决定调用工具时触发"""
        self._step_start = time.time()
        self._current_tool = action.tool
        self.steps.append({
            "type": "action",
            "tool": action.tool,
            "tool_input": str(action.tool_input),
            "log": action.log,
            "timestamp": time.strftime("%H:%M:%S"),
        })
        logger.info(
            "[Agent] Action: %s | Input: %s",
            action.tool,
            str(action.tool_input)[:200],
        )

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        """当工具执行完成时触发"""
        elapsed = time.time() - self._step_start
        observation = output[:500] + "..." if len(output) > 500 else output
        logger.info(
            "[Agent] Observation (%.2fs): %s",
            elapsed,
            observation,
        )
        if self.steps and self.steps[-1]["type"] == "action":
            self.steps[-1]["observation"] = output
            self.steps[-1]["elapsed"] = f"{elapsed:.2f}s"

    def on_tool_error(self, error: Any, **kwargs: Any) -> None:
        """当工具执行出错时触发"""
        logger.error("[Agent] Tool Error: %s | Tool: %s", error, self._current_tool)
        if self.steps and self.steps[-1]["type"] == "action":
            self.steps[-1]["error"] = str(error)

    def on_agent_finish(self, finish: Any, **kwargs: Any) -> None:
        """当 Agent 完成执行时触发"""
        logger.info("[Agent] Final Answer: %s", str(finish.return_values.get("output", ""))[:200])

    def get_steps(self) -> list[dict]:
        """获取所有执行的步骤记录，用于 Streamlit 思维链展示"""
        return self.steps

    def reset(self):
        """重置步骤记录"""
        self.steps = []