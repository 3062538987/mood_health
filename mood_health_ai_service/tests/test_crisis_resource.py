import re

from app.rag.knowledge_base import KNOWLEDGE_MANIFEST

UNVERIFIED_AVAILABILITY_CLAIM = re.compile(
    r"12356.{0,20}24\s*小时|24\s*小时.{0,20}12356",
    re.DOTALL,
)
UNSAFE_AVAILABILITY_FIXTURE = "全国统一心理援助热线：12356（24 小时）"


def test_detects_explicit_unsafe_12356_availability_fixture() -> None:
    assert UNVERIFIED_AVAILABILITY_CLAIM.search(UNSAFE_AVAILABILITY_FIXTURE) is not None


def test_crisis_knowledge_uses_official_12356_resource() -> None:
    serialized = str(KNOWLEDGE_MANIFEST)
    crisis_records = [record for record in KNOWLEDGE_MANIFEST if "12356" in record.content]
    official_title = "国家卫生健康委办公厅关于应用“12356”全国统一心理援助热线电话号码的通知"
    official_url = (
        "https://www.nhc.gov.cn/yzygj/c100068/202412/"
        "49a1a65386cd4be582d4702fd0926ee8.shtml"
    )

    assert len(crisis_records) == 1
    assert "全国统一心理援助热线：12356" in crisis_records[0].content
    assert crisis_records[0].reference == official_title
    assert crisis_records[0].url == official_url
    assert "信任的人" in crisis_records[0].content
    assert "学校" in crisis_records[0].content
    assert "110/120" in crisis_records[0].content
    assert "不能替代紧急救援" in crisis_records[0].content
    assert "400-161-9995" not in serialized
    assert "010-82951332" not in serialized
    assert "全国24小时" not in serialized
    assert UNVERIFIED_AVAILABILITY_CLAIM.search(serialized) is None
