import { SeedDatabase } from './coreSeed'

type FolderRow = { id: number }

type BuiltinResource = {
  slug: string
  title: string
  summary: string
  resourceType: 'article' | 'document' | 'link'
  sourceUrl: string
  licenseCode: string
  reviewedAt: string
}

const BUILTIN_RESOURCES: readonly BuiltinResource[] = [
  {
    slug: 'who-doing-what-matters',
    title: '压力时期的重要行动：图解实践指南',
    summary: '世界卫生组织发布的压力管理实践指南，涵盖立足当下、摆脱纠缠、依循价值等练习。',
    resourceType: 'document',
    sourceUrl: 'https://www.who.int/publications/b/53604',
    licenseCode: 'CC-BY-NC-SA-3.0-IGO',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'nimh-mental-health-topics',
    title: '心理健康主题索引',
    summary: '美国国家心理健康研究所整理的心理健康主题、症状、治疗与求助信息入口。',
    resourceType: 'link',
    sourceUrl: 'https://www.nimh.nih.gov/health/topics',
    licenseCode: 'US-GOV-PUBLIC-DOMAIN-TEXT',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'nimh-caring-for-mental-health',
    title: '照顾自己的心理健康',
    summary: '从运动、睡眠、放松、目标和社会支持等方面介绍日常自我照护及何时寻求帮助。',
    resourceType: 'article',
    sourceUrl: 'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health',
    licenseCode: 'US-GOV-PUBLIC-DOMAIN-TEXT',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'nimh-anxiety-disorders',
    title: '认识焦虑障碍',
    summary: '介绍焦虑障碍的常见表现、风险因素、诊断治疗和寻求专业支持的方式。',
    resourceType: 'article',
    sourceUrl: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
    licenseCode: 'US-GOV-PUBLIC-DOMAIN-TEXT',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'cdc-managing-stress',
    title: '管理压力与建立韧性',
    summary: '美国疾控中心关于识别压力反应、健康应对和寻求支持的公众健康建议。',
    resourceType: 'link',
    sourceUrl: 'https://www.cdc.gov/mental-health/living-with/index.html',
    licenseCode: 'LINK-ONLY-VERIFY-NOTICE',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'nhc-12356-hotline',
    title: '全国统一心理援助热线 12356',
    summary: '国家卫生健康委关于全国统一心理援助热线 12356 的政策与服务说明。',
    resourceType: 'link',
    sourceUrl: 'https://www.nhc.gov.cn/yzygj/c100068/202412/49a1a65386cd4be582d4702fd0926ee8.shtml',
    licenseCode: 'OFFICIAL-LINK-ONLY',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'moe-college-mental-health-guideline',
    title: '高等学校学生心理健康教育指导纲要',
    summary: '教育部关于高校心理健康教育、咨询服务、预防干预和队伍建设的指导文件。',
    resourceType: 'link',
    sourceUrl: 'https://www.moe.gov.cn/srcsite/A12/moe_1407/s3020/201807/t20180713_342992.html',
    licenseCode: 'OFFICIAL-LINK-ONLY',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'moe-college-health-guideline',
    title: '普通高等学校健康教育指导纲要',
    summary: '教育部高校健康教育纲要，包含睡眠、运动、心理健康和焦虑抑郁识别与求助内容。',
    resourceType: 'link',
    sourceUrl: 'https://www.moe.gov.cn/srcsite/A17/moe_943/moe_946/201707/t20170710_308998.html',
    licenseCode: 'OFFICIAL-LINK-ONLY',
    reviewedAt: '2026-08-13',
  },
  {
    slug: 'unicef-helping-adolescents-thrive',
    title: 'Helping Adolescents Thrive',
    summary: '联合国儿童基金会面向青少年心理健康促进与预防的活动和带领者指南。',
    resourceType: 'link',
    sourceUrl: 'https://www.unicef.org/adolescentmentalhealthhub/documents/helping-adolescents-thrive-facilitator-guide',
    licenseCode: 'OFFICIAL-LINK-ONLY',
    reviewedAt: '2026-08-13',
  },
] as const

const toMysqlDateTime = (date: Date): string => date.toISOString().slice(0, 23).replace('T', ' ')

export const seedKnowledgeResources = async (
  db: SeedDatabase,
  now: Date = new Date('2026-08-13T00:00:00.000Z')
): Promise<{ count: number }> => {
  const timestamp = toMysqlDateTime(now)
  await db.query(
    `INSERT INTO knowledge_folders
      (slug, name, description, is_builtin, owner_user_id, created_at, updated_at)
     VALUES (?, ?, ?, 1, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), description = VALUES(description), is_builtin = 1,
       owner_user_id = NULL, updated_at = VALUES(updated_at)`,
    ['builtin', '内置资料', '平台审核并保留来源与许可信息的权威资料', timestamp, timestamp]
  )

  const folders = await db.query<FolderRow>(
    'SELECT id FROM knowledge_folders WHERE slug = ? LIMIT 1',
    ['builtin']
  )
  const folderId = folders[0]?.id
  if (!folderId) {
    throw new Error('内置资料文件夹创建失败')
  }

  for (const resource of BUILTIN_RESOURCES) {
    await db.query(
      `INSERT INTO knowledge_resources
        (folder_id, slug, title, summary, resource_type, source_url, license_code,
         ingestion_status, reviewed_at, is_builtin, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, 1, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         folder_id = VALUES(folder_id), title = VALUES(title), summary = VALUES(summary),
         resource_type = VALUES(resource_type), source_url = VALUES(source_url),
         license_code = VALUES(license_code), reviewed_at = VALUES(reviewed_at),
         is_builtin = 1, is_active = 1, updated_at = VALUES(updated_at)`,
      [
        folderId,
        resource.slug,
        resource.title,
        resource.summary,
        resource.resourceType,
        resource.sourceUrl,
        resource.licenseCode,
        resource.reviewedAt,
        timestamp,
        timestamp,
      ]
    )
  }

  return { count: BUILTIN_RESOURCES.length }
}
