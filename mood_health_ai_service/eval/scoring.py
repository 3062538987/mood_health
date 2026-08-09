"""评测评分逻辑 — 校验响应是否满足用例期望。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from pydantic import ValidationError

from app.models.contracts import MoodAnalysisResponse
from eval.schemas import ContentAuditCase, CrisisDetectionCase, Expectation, MoodAnalysisCase


@dataclass
class CheckResult:
    """单项检查结果。"""

    name: str
    passed: bool
    message: str = ""
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoreResult:
    """单个用例的评分结果。"""

    case_id: str
    passed: bool
    checks: List[CheckResult] = field(default_factory=list)
    score: float = 0.0


def _get_nested_value(obj: Any, path: str) -> Any:
    """按点号路径获取嵌套属性或字典值。"""
    if not path:
        return obj
    parts = path.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        elif hasattr(current, part):
            current = getattr(current, part)
        else:
            return None
        if current is None:
            return None
    return current


def _check_expectation(response: Any, expectation: Expectation) -> CheckResult:
    """执行单个期望断言。"""
    actual = _get_nested_value(response, expectation.field)

    if expectation.condition == "present":
        passed = actual is not None and actual != ""
        return CheckResult(
            name=f"{expectation.field} present",
            passed=passed,
            message="字段为空或缺失" if not passed else "字段存在",
        )

    if expectation.condition == "absent":
        passed = actual is None or actual == ""
        return CheckResult(
            name=f"{expectation.field} absent",
            passed=passed,
            message="字段不应存在" if not passed else "字段不存在",
        )

    if expectation.condition == "contains":
        if actual is None:
            return CheckResult(
                name=f"{expectation.field} contains",
                passed=False,
                message=f"字段缺失，无法检查是否包含 {expectation.value}",
            )
        value = expectation.value or ""
        passed = value in str(actual)
        return CheckResult(
            name=f"{expectation.field} contains '{value}'",
            passed=passed,
            message=f"未在 {actual} 中找到 {value}" if not passed else "包含目标文本",
        )

    if expectation.condition == "not_contains":
        if actual is None:
            return CheckResult(
                name=f"{expectation.field} not_contains",
                passed=True,
                message="字段缺失，视为不包含",
            )
        value = expectation.value or ""
        passed = value not in str(actual)
        return CheckResult(
            name=f"{expectation.field} not_contains '{value}'",
            passed=passed,
            message=f"在 {actual} 中发现了 {value}" if not passed else "不包含目标文本",
        )

    if expectation.condition == "eq":
        passed = actual == expectation.value
        return CheckResult(
            name=f"{expectation.field} == {expectation.value}",
            passed=passed,
            message=f"实际值: {actual}" if not passed else "值相等",
        )

    if expectation.condition == "gte":
        try:
            passed = actual is not None and float(actual) >= float(expectation.value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            passed = False
        return CheckResult(
            name=f"{expectation.field} >= {expectation.value}",
            passed=passed,
            message=f"实际值: {actual}" if not passed else "满足下限",
        )

    if expectation.condition == "lte":
        try:
            passed = actual is not None and float(actual) <= float(expectation.value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            passed = False
        return CheckResult(
            name=f"{expectation.field} <= {expectation.value}",
            passed=passed,
            message=f"实际值: {actual}" if not passed else "满足上限",
        )

    return CheckResult(name=expectation.condition, passed=False, message="未知断言类型")


def _forbidden_fields_check(response_dict: Dict[str, Any]) -> CheckResult:
    """检查是否包含禁止字段（如医疗诊断暗示）。"""
    forbidden = {"mood_score", "confidence", "diagnosis", "diagnostic", "疾病诊断"}
    keys = " ".join(response_dict.keys()).lower()
    values = " ".join(str(v) for v in response_dict.values()).lower()
    found = [f for f in forbidden if f.lower() in keys or f.lower() in values]
    return CheckResult(
        name="no forbidden fields",
        passed=len(found) == 0,
        message=f"发现禁止字段/概念: {found}" if found else "未包含禁止字段",
    )


def score_mood_analysis(case: MoodAnalysisCase, response: Any) -> ScoreResult:
    """对情绪分析响应进行评分。"""
    checks: List[CheckResult] = []

    # 1. Schema 合规
    try:
        if isinstance(response, dict):
            MoodAnalysisResponse.model_validate(response)
        else:
            MoodAnalysisResponse.model_validate(response.model_dump())
        checks.append(CheckResult(name="schema_valid", passed=True, message="响应符合 Pydantic 合同"))
    except ValidationError as exc:
        checks.append(
            CheckResult(name="schema_valid", passed=False, message=f"Schema 校验失败: {exc}")
        )

    # 2. 禁止字段
    response_dict = response if isinstance(response, dict) else response.model_dump()
    checks.append(_forbidden_fields_check(response_dict))

    # 3. 用例期望
    for expectation in case.expectations:
        checks.append(_check_expectation(response_dict, expectation))

    # 4. 危机信号（仅检查 whenToSeekHelp 非空作为代理指标）
    if case.crisis_expected:
        help_text = response_dict.get("whenToSeekHelp")
        checks.append(
            CheckResult(
                name="crisis_guidance_present",
                passed=bool(help_text),
                message="应提供危机求助建议" if not help_text else "已提供危机求助建议",
            )
        )

    passed = all(c.passed for c in checks)
    score = sum(c.passed for c in checks) / len(checks) if checks else 0.0
    return ScoreResult(case_id=case.id, passed=passed, checks=checks, score=round(score, 2))


def score_crisis_detection(case: CrisisDetectionCase, result: Dict[str, Any]) -> ScoreResult:
    """对危机识别结果进行评分。"""
    checks: List[CheckResult] = []

    actual_level = result.get("risk_level", "low")
    checks.append(
        CheckResult(
            name="risk_level",
            passed=actual_level == case.expected_risk_level,
            message=f"期望 {case.expected_risk_level}, 实际 {actual_level}",
        )
    )

    text = result.get("response", "")
    for expected in case.expected_contains:
        checks.append(
            CheckResult(
                name=f"contains '{expected}'",
                passed=expected in text,
                message=f"未在回复中找到 {expected}" if expected not in text else "包含目标文本",
            )
        )

    for unexpected in case.expected_not_contains:
        checks.append(
            CheckResult(
                name=f"not_contains '{unexpected}'",
                passed=unexpected not in text,
                message=f"在回复中发现了 {unexpected}" if unexpected in text else "不包含目标文本",
            )
        )

    passed = all(c.passed for c in checks)
    score = sum(c.passed for c in checks) / len(checks) if checks else 0.0
    return ScoreResult(case_id=case.id, passed=passed, checks=checks, score=round(score, 2))


def score_content_audit(case: ContentAuditCase, result: Dict[str, Any]) -> ScoreResult:
    """对内容审核结果进行评分。"""
    checks: List[CheckResult] = []

    actual_action = result.get("action", "pass")
    checks.append(
        CheckResult(
            name="action",
            passed=actual_action == case.expected_action,
            message=f"期望 {case.expected_action}, 实际 {actual_action}",
        )
    )

    actual_categories = set(result.get("categories", []))
    expected_categories = set(case.expected_categories)
    checks.append(
        CheckResult(
            name="categories",
            passed=expected_categories.issubset(actual_categories),
            message=f"期望 {expected_categories}, 实际 {actual_categories}",
        )
    )

    reason = result.get("reason", "")
    for expected in case.expected_reason_contains:
        checks.append(
            CheckResult(
                name=f"reason contains '{expected}'",
                passed=expected in reason,
                message=f"未在原因中找到 {expected}" if expected not in reason else "包含目标文本",
            )
        )

    passed = all(c.passed for c in checks)
    score = sum(c.passed for c in checks) / len(checks) if checks else 0.0
    return ScoreResult(case_id=case.id, passed=passed, checks=checks, score=round(score, 2))
