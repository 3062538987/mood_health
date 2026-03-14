"""
日志模块

提供统一的日志配置和日志实例管理
"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from typing import Optional

from .config import settings


def setup_logging(
    level: Optional[str] = None,
    log_file: Optional[str] = None,
    format_string: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """
    初始化日志配置
    
    配置根日志记录器，支持控制台和文件输出
    
    Args:
        level: 日志级别，默认从配置读取
        log_file: 日志文件路径，默认从配置读取
        format_string: 日志格式，默认从配置读取
        max_bytes: 单个日志文件最大大小（字节）
        backup_count: 保留的备份文件数量
        
    Returns:
        logging.Logger: 配置好的根日志记录器
    """
    # 使用配置默认值
    level = level or settings.LOG_LEVEL
    log_file = log_file or settings.LOG_FILE
    format_string = format_string or settings.LOG_FORMAT
    
    # 获取根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # 清除现有处理器
    root_logger.handlers.clear()
    
    # 创建格式化器
    formatter = logging.Formatter(format_string)
    
    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # 文件处理器（如果配置了日志文件）
    if log_file:
        # 确保日志目录存在
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 使用 RotatingFileHandler 实现日志轮转
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(getattr(logging, level.upper()))
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """
    获取命名日志记录器
    
    为指定模块创建日志记录器实例
    
    Args:
        name: 日志记录器名称，通常使用 __name__
        
    Returns:
        logging.Logger: 命名日志记录器
    """
    return logging.getLogger(name)


# 全局日志记录器实例
logger = get_logger(__name__)


class LoggerMixin:
    """
    日志混入类
    
    为类提供便捷的日志记录功能，继承此类即可获得 self.logger
    
    Example:
        class MyService(LoggerMixin):
            def do_something(self):
                self.logger.info("执行操作")
    """
    
    @property
    def logger(self) -> logging.Logger:
        """获取当前类的日志记录器"""
        return get_logger(self.__class__.__module__ + '.' + self.__class__.__name__)


# 初始化默认日志配置（在导入时自动执行）
def _init_default_logging():
    """初始化默认日志配置"""
    # 检查是否已经配置
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        setup_logging()


# 自动初始化
_init_default_logging()
