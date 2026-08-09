import { CRISIS_SUPPORT } from '../../../src/constants/crisisSupport'
import { HIGH_RISK_ESCALATION } from '../../../src/utils/ai/aiSafetyService'

const UNVERIFIED_AVAILABILITY_CLAIM =
  /12356.{0,20}24\s*小时|24\s*小时.{0,20}12356/s
const UNSAFE_AVAILABILITY_FIXTURE = '全国统一心理援助热线：12356（24 小时）'

describe('official crisis support resource', () => {
  it('uses the reviewed national 12356 resource as the Node source of truth', () => {
    expect(CRISIS_SUPPORT).toEqual({
      name: '全国统一心理援助热线',
      number: '12356',
      sourceTitle: '国家卫生健康委办公厅关于应用“12356”全国统一心理援助热线电话号码的通知',
      sourceUrl: 'https://www.nhc.gov.cn/yzygj/c100068/202412/49a1a65386cd4be582d4702fd0926ee8.shtml',
      reviewedAt: '2026-08-09',
    })
  })

  it('detects an explicit unsafe 12356 availability fixture', () => {
    expect(UNSAFE_AVAILABILITY_FIXTURE).toMatch(UNVERIFIED_AVAILABILITY_CLAIM)
  })

  it('keeps high-risk fallback actionable without old or universal 24-hour claims', () => {
    const fallbackText = JSON.stringify(HIGH_RISK_ESCALATION)

    expect(fallbackText).toContain('全国统一心理援助热线：12356')
    expect(fallbackText).toContain('信任的人')
    expect(fallbackText).toContain('110')
    expect(fallbackText).toContain('120')
    expect(fallbackText).not.toMatch(UNVERIFIED_AVAILABILITY_CLAIM)
    expect(fallbackText).not.toMatch(/400-161-9995|010-82951332|全国24\s*小时/)
  })
})
