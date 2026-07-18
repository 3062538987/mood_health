"""评测集加载器测试。"""

import pytest

from eval.loader import list_datasets, list_versions, load_dataset
from eval.schemas import MoodAnalysisCase


def test_list_versions_includes_v1():
    """v1 版本目录可见。"""
    versions = list_versions()
    assert "v1" in versions


def test_list_datasets_v1():
    """v1 版本只列出已存在的数据集。"""
    datasets = list_datasets("v1")
    assert "mood_analysis" in datasets


def test_load_mood_analysis_v1():
    """加载情绪分析 v1 数据集，校验用例可被 Pydantic 接受。"""
    dataset = load_dataset("v1", "mood_analysis")
    assert dataset.version == "v1"
    assert dataset.name == "mood_analysis"
    assert len(dataset.cases) >= 1
    assert all(isinstance(c, MoodAnalysisCase) for c in dataset.cases)


def test_load_unknown_dataset_raises():
    """未注册数据集名称抛 ValueError。"""
    with pytest.raises(ValueError):
        load_dataset("v1", "unknown_dataset")


def test_load_missing_version_raises():
    """缺失版本目录抛 FileNotFoundError。"""
    with pytest.raises(FileNotFoundError):
        load_dataset("v999", "mood_analysis")
