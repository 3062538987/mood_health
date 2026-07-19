"""
全局日志配置 — 同时输出到终端和文件。
日志格式包含时间戳、级别、模块名，便于调试 Agent 推理过程。
"""

import logging
import os
import sys
from datetime import datetime


def setup_logger(name: str = "agent_app", log_dir: str = None) -> logging.Logger:
    """
    创建并配置全局 Logger。

    Args:
        name: Logger 名称，默认 "agent_app"
        log_dir: 日志文件目录，默认 agent_app/logs/

    Returns:
        配置好的 Logger 实例
    """
    if log_dir is None:
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")

    os.makedirs(log_dir, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    if logger.handlers:
        return logger

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)-20s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 终端输出 INFO 及以上
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(fmt)
    logger.addHandler(console_handler)

    # 文件输出 DEBUG 及以上，按日期命名
    log_file = os.path.join(log_dir, f"agent_{datetime.now().strftime('%Y%m%d')}.log")
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


def get_logger(name: str = "agent_app") -> logging.Logger:
    """获取或创建指定名称的 Logger"""
    return logging.getLogger(name)