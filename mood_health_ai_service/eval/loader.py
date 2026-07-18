"""评测集加载器 — 按版本号加载 JSON 数据集。"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Type

from eval.schemas import (
    ContentAuditCase,
    CrisisDetectionCase,
    Dataset,
    MoodAnalysisCase,
)

DATASET_ROOT = Path(__file__).parent / "datasets"

_DATASET_REGISTRY: Dict[str, Dict[str, Type]] = {
    "mood_analysis": {"case_type": MoodAnalysisCase, "filename": "mood_analysis.json"},
    "crisis_detection": {"case_type": CrisisDetectionCase, "filename": "crisis_detection.json"},
    "content_audit": {"case_type": ContentAuditCase, "filename": "content_audit.json"},
}


def list_versions() -> List[str]:
    """返回所有可用的数据集版本目录。"""
    if not DATASET_ROOT.exists():
        return []
    return sorted([d.name for d in DATASET_ROOT.iterdir() if d.is_dir()])


def list_datasets(version: str) -> List[str]:
    """返回某版本下可用的数据集名称。"""
    version_dir = DATASET_ROOT / version
    if not version_dir.exists():
        return []
    available = []
    for name, meta in _DATASET_REGISTRY.items():
        if (version_dir / meta["filename"]).exists():
            available.append(name)
    return available


def load_dataset(version: str, name: str) -> Dataset:
    """加载指定版本和名称的数据集。

    Args:
        version: 版本号，如 "v1"。
        name: 数据集名称，如 "mood_analysis"。

    Raises:
        FileNotFoundError: 数据集文件不存在。
        ValueError: 数据集名称未注册。
    """
    if name not in _DATASET_REGISTRY:
        raise ValueError(
            f"Unknown dataset '{name}'. Available: {list(_DATASET_REGISTRY.keys())}"
        )

    meta = _DATASET_REGISTRY[name]
    file_path = DATASET_ROOT / version / meta["filename"]
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    case_type = meta["case_type"]
    cases = [case_type.model_validate(item) for item in raw.get("cases", [])]

    return Dataset(
        version=version,
        name=name,
        description=raw.get("description", ""),
        cases=cases,
    )


def get_dataset_path(version: str, name: str) -> Path:
    """返回数据集文件路径（不加载）。"""
    if name not in _DATASET_REGISTRY:
        raise ValueError(f"Unknown dataset '{name}'")
    return DATASET_ROOT / version / _DATASET_REGISTRY[name]["filename"]
