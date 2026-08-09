export const CRISIS_SUPPORT = Object.freeze({
  name: '全国统一心理援助热线',
  number: '12356',
  sourceTitle: '国家卫生健康委办公厅关于应用“12356”全国统一心理援助热线电话号码的通知',
  sourceUrl: 'https://www.nhc.gov.cn/yzygj/c100068/202412/49a1a65386cd4be582d4702fd0926ee8.shtml',
  reviewedAt: '2026-08-09',
} as const)

export const formatCrisisSupport = (): string =>
  `${CRISIS_SUPPORT.name}：${CRISIS_SUPPORT.number}`
