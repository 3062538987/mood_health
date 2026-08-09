"""Audited, student-facing mental-health knowledge manifest."""

import re
from dataclasses import dataclass, fields
from datetime import date
from urllib.parse import urlsplit

_SAFE_ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass(frozen=True)
class KnowledgeRecord:
    id: str
    title: str
    content: str
    reference: str
    url: str
    reviewedAt: str  # noqa: N815


def validate_knowledge_manifest(manifest: tuple[KnowledgeRecord, ...]) -> None:
    """Reject malformed or unauditable knowledge before it reaches retrieval."""
    if not manifest:
        raise ValueError("knowledge manifest must not be empty")

    field_names = tuple(field.name for field in fields(KnowledgeRecord))
    seen_ids: set[str] = set()
    for record in manifest:
        for field_name in field_names:
            value = getattr(record, field_name)
            if not value or value != value.strip():
                raise ValueError(
                    f"knowledge field {field_name} must be non-empty and trimmed"
                )

        if _SAFE_ID.fullmatch(record.id) is None:
            raise ValueError("knowledge id must be a safe lowercase ASCII slug")
        if record.id in seen_ids:
            raise ValueError(f"duplicate knowledge id: {record.id}")
        seen_ids.add(record.id)

        parsed_url = urlsplit(record.url)
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            raise ValueError(f"knowledge record {record.id} must use an HTTPS URL")

        try:
            if _ISO_DATE.fullmatch(record.reviewedAt) is None:
                raise ValueError
            date.fromisoformat(record.reviewedAt)
        except ValueError as error:
            raise ValueError(
                f"knowledge record {record.id} must use an ISO review date"
            ) from error


_WHO_STRESS_REFERENCE = "WHO, Doing What Matters in Times of Stress"
_WHO_STRESS_URL = "https://www.who.int/publications-detail-redirect/9789240003927"
_WHO_ACTIVITY_REFERENCE = "WHO, Physical activity fact sheet"
_WHO_ACTIVITY_URL = (
    "https://www.who.int/news-room/fact-sheets/detail/physical-activity%E2%80%AF"
)
_NIMH_REFERENCE = "NIMH, Caring for Your Mental Health"
_NIMH_URL = "https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health"
_NHC_CRISIS_REFERENCE = "国家卫生健康委办公厅关于应用“12356”全国统一心理援助热线电话号码的通知"
_NHC_CRISIS_URL = (
    "https://www.nhc.gov.cn/yzygj/c100068/202412/"
    "49a1a65386cd4be582d4702fd0926ee8.shtml"
)


KNOWLEDGE_MANIFEST: tuple[KnowledgeRecord, ...] = (
    KnowledgeRecord(
        id="present-moment-grounding",
        title="压力来临时回到当下",
        content=(
            "压力涌来时，可以先留意脚与地面的接触、自然呼吸，以及周围能看到或听到的事物，"
            "再选择眼下可做的一步。这是一种练习选项，不要求立刻消除所有压力。"
        ),
        reference=_WHO_STRESS_REFERENCE,
        url=_WHO_STRESS_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="small-actions-priorities",
        title="把任务拆成可做的小行动",
        content=(
            "事情堆在一起时，可以先列出当前任务和优先事项，选择一个足够小、现在能够完成的行动；"
            "当负担已经过重，也可以暂缓新增任务或向他人求助。"
        ),
        reference=_NIMH_REFERENCE,
        url=_NIMH_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="daily-care-and-connection",
        title="日常照顾与保持连接",
        content=(
            "可以从规律吃饭、补充水分、安排放松活动和联系信任的人开始照顾自己。"
            "选择一两项容易做到的行动即可，不必一次改变全部习惯。"
        ),
        reference=_NIMH_REFERENCE,
        url=_NIMH_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="sleep-routine",
        title="建立较稳定的睡眠节奏",
        content=(
            "可以尝试保持相对固定的入睡和起床时间，并在睡前减少电子设备蓝光；"
            "如果睡眠困扰持续或明显影响日常生活，可联系学校支持或合格专业人员。"
        ),
        reference=_NIMH_REFERENCE,
        url=_NIMH_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="gentle-physical-activity",
        title="从温和身体活动开始",
        content=(
            "身体活动可以包括步行、骑行、运动或日常活动。可以按自己的身体状况从少量、温和的活动开始，"
            "逐步增加；即使活动不多，也比完全不动更有益。"
        ),
        reference=_WHO_ACTIVITY_REFERENCE,
        url=_WHO_ACTIVITY_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="seek-qualified-support",
        title="何时寻求学校或专业支持",
        content=(
            "当心理困扰持续、加重，或已经影响学习、睡眠、人际关系和日常生活时，可以联系学校心理中心、"
            "医疗机构或其他合格的心理健康专业人员。主动求助是可选择的支持方式，不等同于自我诊断。"
        ),
        reference=_NIMH_REFERENCE,
        url=_NIMH_URL,
        reviewedAt="2026-08-09",
    ),
    KnowledgeRecord(
        id="official-crisis-path",
        title="出现紧急危险时的求助路径",
        content=(
            "如果自己或他人存在立即危险，请尽快联系身边信任的人或学校支持，并拨打当地紧急服务 "
            "110/120；也可拨打全国统一心理援助热线：12356。AI 和心理援助热线不能替代紧急救援。"
        ),
        reference=_NHC_CRISIS_REFERENCE,
        url=_NHC_CRISIS_URL,
        reviewedAt="2026-08-09",
    ),
)


validate_knowledge_manifest(KNOWLEDGE_MANIFEST)
