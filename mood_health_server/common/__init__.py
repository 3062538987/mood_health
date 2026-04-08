"""
通用工具模块

提供配置、日志、工具函数等通用功能
"""

from .config import (
    Settings,
    get_settings,
    settings,
)
from .logger import (
    get_logger,
    LoggerMixin,
    logger,
    setup_logging,
)
from .utils import (
    common_chunk_list,
    common_extract_json_from_text,
    common_format_datetime,
    common_generate_cache_key,
    common_generate_id,
    common_generate_short_id,
    common_mask_sensitive_info,
    common_parse_datetime,
    common_remove_html_tags,
    common_safe_json_loads,
    common_sanitize_string,
    common_slice_text,
    common_truncate_text,
    common_validate_email,
    common_validate_phone,
)

__all__ = [
    # Config
    "Settings",
    "get_settings",
    "settings",
    # Logger
    "get_logger",
    "LoggerMixin",
    "logger",
    "setup_logging",
    # Utils
    "common_generate_id",
    "common_generate_short_id",
    "common_format_datetime",
    "common_parse_datetime",
    "common_sanitize_string",
    "common_validate_email",
    "common_validate_phone",
    "common_slice_text",
    "common_generate_cache_key",
    "common_truncate_text",
    "common_safe_json_loads",
    "common_extract_json_from_text",
    "common_mask_sensitive_info",
    "common_chunk_list",
    "common_remove_html_tags",
]
