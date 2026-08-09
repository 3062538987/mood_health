"""聊天输入内容审核（P0 基线）。

目前做输入合法性校验（非空、长度上限），避免空/异常请求直达模型；
更深的内容安全（违规词、自伤风险等）由 CHAT_SYSTEM_PROMPT 引导模型处理，
后续可接入模型级审核 API。审核失败返回 (False, 拒绝原因)。
"""

from collections.abc import Iterable

_MAX_TOTAL_CHARS = 8000


def moderate_messages(messages: Iterable[dict[str, str]]) -> tuple[bool, str | None]:
    """校验传入对话是否被允许进入模型。

    返回 (通过, 拒绝原因)。所有非空消息字符数合计超过上限即拒绝。
    """
    total = 0
    for message in messages:
        content = (message.get("content") or "").strip()
        total += len(content)
        if total > _MAX_TOTAL_CHARS:
            return False, "输入内容过长"

    if total == 0:
        return False, "消息内容为空"

    return True, None
