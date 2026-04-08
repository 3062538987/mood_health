"""
通用工具函数模块

提供文本处理、ID生成、日期格式化等公共辅助函数
"""

import hashlib
import json
import re
import uuid
from datetime import datetime
from typing import Any, List, Optional, Union

from .logger import get_logger

logger = get_logger(__name__)


def common_generate_id() -> str:
    """
    生成唯一标识符
    
    Returns:
        str: UUID字符串
    """
    return str(uuid.uuid4())


def common_generate_short_id(length: int = 8) -> str:
    """
    生成短ID（基于UUID前N位）
    
    Args:
        length: ID长度，默认8位
        
    Returns:
        str: 短ID字符串
    """
    return uuid.uuid4().hex[:length]


def common_format_datetime(dt: Optional[datetime] = None, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    格式化日期时间
    
    Args:
        dt: 日期时间对象，默认为当前时间
        fmt: 格式化字符串
        
    Returns:
        str: 格式化后的日期时间字符串
    """
    if dt is None:
        dt = datetime.now()
    return dt.strftime(fmt)


def common_parse_datetime(date_string: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> Optional[datetime]:
    """
    解析日期时间字符串
    
    Args:
        date_string: 日期时间字符串
        fmt: 格式化字符串
        
    Returns:
        Optional[datetime]: 解析后的日期时间对象，失败返回None
    """
    try:
        return datetime.strptime(date_string, fmt)
    except ValueError:
        logger.warning(f"日期解析失败: {date_string}")
        return None


def common_sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """
    清理字符串（去除特殊字符、控制字符）
    
    Args:
        text: 原始字符串
        max_length: 最大长度，超出则截断
        
    Returns:
        str: 清理后的字符串
    """
    if not text:
        return ""
    
    # 去除控制字符
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    # 去除首尾空白
    text = text.strip()
    
    # 截断超长文本
    if max_length and len(text) > max_length:
        text = text[:max_length]
        logger.debug(f"字符串已截断至 {max_length} 字符")
    
    return text


def common_validate_email(email: str) -> bool:
    """
    验证邮箱格式
    
    Args:
        email: 邮箱地址
        
    Returns:
        bool: 是否有效
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def common_validate_phone(phone: str) -> bool:
    """
    验证手机号格式（中国大陆）
    
    Args:
        phone: 手机号
        
    Returns:
        bool: 是否有效
    """
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None


def common_slice_text(text: str, chunk_size: int, overlap: int = 0) -> List[str]:
    """
    文本切片（兜底函数）
    
    将长文本切分为固定长度的片段，支持重叠
    
    Args:
        text: 原始文本
        chunk_size: 每个片段的长度
        overlap: 片段间重叠字符数
        
    Returns:
        List[str]: 文本片段列表
        
    Example:
        >>> common_slice_text("abcdefghij", 3, 1)
        ['abc', 'cde', 'efg', 'ghi']
    """
    if not text or chunk_size <= 0:
        return []
    
    if overlap >= chunk_size:
        overlap = chunk_size - 1
    
    chunks = []
    step = chunk_size - overlap
    
    for i in range(0, len(text), step):
        chunk = text[i:i + chunk_size]
        if chunk:  # 确保不添加空字符串
            chunks.append(chunk)
    
    return chunks


def common_generate_cache_key(*args, prefix: str = "") -> str:
    """
    生成缓存键
    
    基于输入参数生成MD5哈希缓存键
    
    Args:
        *args: 参与生成键的参数
        prefix: 键前缀
        
    Returns:
        str: MD5哈希字符串
    """
    # 将所有参数序列化为字符串
    key_parts = []
    for arg in args:
        if isinstance(arg, (dict, list)):
            key_parts.append(json.dumps(arg, sort_keys=True, ensure_ascii=False))
        else:
            key_parts.append(str(arg))
    
    text = ":".join(key_parts)
    hash_value = hashlib.md5(text.encode('utf-8')).hexdigest()
    
    if prefix:
        return f"{prefix}:{hash_value}"
    return hash_value


def common_truncate_text(text: str, max_length: int, suffix: str = "...") -> str:
    """
    截断文本
    
    Args:
        text: 原始文本
        max_length: 最大长度
        suffix: 截断后缀
        
    Returns:
        str: 截断后的文本
    """
    if not text or len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def common_safe_json_loads(text: str, default: Any = None) -> Any:
    """
    安全解析JSON
    
    Args:
        text: JSON字符串
        default: 解析失败时的默认值
        
    Returns:
        Any: 解析结果或默认值
    """
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"JSON解析失败: {e}")
        return default


def common_extract_json_from_text(text: str) -> Optional[dict]:
    """
    从文本中提取JSON对象
    
    用于处理AI模型返回的包含JSON的文本
    
    Args:
        text: 包含JSON的文本
        
    Returns:
        Optional[dict]: 提取的JSON对象，失败返回None
    """
    try:
        # 查找JSON起始和结束位置
        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        
        if json_start != -1 and json_end > json_start:
            json_str = text[json_start:json_end]
            return json.loads(json_str)
        
        # 尝试查找数组
        json_start = text.find("[")
        json_end = text.rfind("]") + 1
        
        if json_start != -1 and json_end > json_start:
            json_str = text[json_start:json_end]
            return json.loads(json_str)
        
        return None
    except json.JSONDecodeError as e:
        logger.warning(f"JSON提取失败: {e}")
        return None


def common_mask_sensitive_info(text: str, mask: str = "***") -> str:
    """
    脱敏处理（手机号、身份证号、邮箱等）
    
    Args:
        text: 原始文本
        mask: 替换掩码
        
    Returns:
        str: 脱敏后的文本
    """
    if not text:
        return text
    
    # 手机号脱敏
    text = re.sub(r'(1[3-9]\d)\d{4}(\d{4})', r'\1****\2', text)
    
    # 身份证号脱敏
    text = re.sub(r'(\d{4})\d{10}(\d{4})', r'\1**********\2', text)
    
    # 邮箱脱敏
    text = re.sub(r'(\w{2})\w+(@\w+)', r'\1***\2', text)
    
    return text


def common_chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """
    列表分块
    
    Args:
        lst: 原始列表
        chunk_size: 每块大小
        
    Returns:
        List[List[Any]]: 分块后的列表
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def common_remove_html_tags(text: str) -> str:
    """
    去除HTML标签
    
    Args:
        text: 包含HTML的文本
        
    Returns:
        str: 纯文本
    """
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)
