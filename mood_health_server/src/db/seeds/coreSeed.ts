export interface SeedDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface ReferenceRole {
  code: 'student' | 'counselor' | 'super_admin' | 'admin'
  name: string
  description: string
}

export interface ReferencePermission {
  code: string
  name: string
  description: string
}

export interface ReferenceSeedResult {
  roles: number
  permissions: number
  rolePermissions: number
  emotionTypes: number
  systemTags: number
}

export const REFERENCE_ROLES: ReferenceRole[] = [
  {
    code: 'student',
    name: '学生用户',
    description: '仅访问本人资料、本人情绪记录和本人测评记录',
  },
  {
    code: 'counselor',
    name: '心理工作人员',
    description: '访问匿名聚合统计；R0 不开放风险个案详情',
  },
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '管理用户、角色分配和系统审计；默认不读取心理正文',
  },
  {
    code: 'admin',
    name: '管理员',
    description: '管理内容审核、活动、课程、音乐等运营功能',
  },
]

export const REFERENCE_PERMISSIONS: ReferencePermission[] = [
  { code: 'auth.profile.read', name: '读取个人资料', description: '读取当前登录用户的基础资料' },
  { code: 'mood.record.create', name: '创建本人情绪记录', description: '创建当前用户自己的情绪记录' },
  { code: 'mood.record.read_own', name: '读取本人情绪记录', description: '读取当前用户自己的情绪记录' },
  { code: 'mood.record.update_own', name: '更新本人情绪记录', description: '更新当前用户自己的情绪记录' },
  { code: 'mood.record.delete_own', name: '删除本人情绪记录', description: '删除当前用户自己的情绪记录' },
  { code: 'assessment.instrument.read', name: '读取测评目录', description: '读取已开放的测评目录' },
  { code: 'assessment.submit', name: '提交本人测评', description: '提交当前用户自己的测评作答' },
  { code: 'assessment.history.read_own', name: '读取本人测评历史', description: '读取当前用户自己的测评历史' },
  { code: 'report.aggregate.read', name: '读取匿名聚合统计', description: '读取不包含心理正文的匿名统计' },
  { code: 'user.manage', name: '管理用户', description: '停用或管理用户账号' },
  { code: 'user.role.assign', name: '分配角色', description: '为用户分配固定角色' },
  { code: 'audit.log.read', name: '读取审计日志', description: '读取系统审计日志' },
  { code: 'case.read_assigned', name: '读取已分配个案', description: '读取已分配给自己或全部个案' },
  { code: 'case.read_own', name: '读取本人个案', description: '学生读取本人个案' },
  { code: 'case.create', name: '创建个案', description: '创建风险个案' },
  { code: 'case.assign', name: '分配个案', description: '将个案分配给咨询师' },
  { code: 'case.intervene', name: '记录干预', description: '在个案下记录干预措施' },
  { code: 'case.refer', name: '转介个案', description: '将个案转介至外部机构' },
  { code: 'case.close', name: '结案', description: '结案并记录结案摘要' },
  { code: 'user.delete', name: '物理删除用户', description: '物理删除用户及其关联数据' },
  { code: 'prompt.manage', name: '管理 Prompt 模板', description: '创建、编辑、删除 AI Prompt 模板' },
  { code: 'incident.fix', name: '修复事件', description: '处理系统异常事件' },
  { code: 'audit.record.view_all', name: '查看所有审计记录', description: '查看全部审计日志' },
  { code: 'post.audit', name: '审核帖子', description: '审核用户发布的帖子内容' },
  { code: 'post.audit.pending.read', name: '读取待审核帖子', description: '读取待审核的帖子列表' },
  { code: 'activity.manage', name: '管理活动', description: '创建、编辑、删除活动' },
  { code: 'course.manage', name: '管理课程', description: '创建、编辑、删除课程' },
  { code: 'music.manage', name: '管理音乐', description: '管理音乐资源' },
  { code: 'report.view', name: '查看报告', description: '查看统计报告' },
  { code: 'feedback.handle', name: '处理反馈', description: '处理用户反馈' },
  { code: 'mood.record.read', name: '读取情绪记录', description: '读取用户情绪记录' },
  { code: 'mood.record.update', name: '更新情绪记录', description: '更新用户情绪记录' },
  { code: 'mood.record.delete', name: '删除情绪记录', description: '删除用户情绪记录' },
  { code: 'mood.advice.history.read', name: '读取情绪建议历史', description: '读取AI情绪建议历史' },
  { code: 'questionnaire.read', name: '读取问卷', description: '读取可用的问卷' },
  { code: 'questionnaire.submit', name: '提交问卷', description: '提交问卷作答' },
  { code: 'post.create', name: '创建帖子', description: '创建讨论帖子' },
  { code: 'post.comment.create', name: '创建评论', description: '对帖子发表评论' },
  { code: 'post.like', name: '点赞帖子', description: '对帖子进行点赞' },
  { code: 'activity.join', name: '参加活动', description: '报名参加活动' },
  { code: 'relax.record.manage', name: '管理放松记录', description: '管理放松训练记录' },
  { code: 'achievement.read', name: '读取成就', description: '读取用户成就' },
  { code: 'auth.register.role_assign', name: '注册时分配角色', description: '在用户注册时自动分配角色' },
]

export const ROLE_PERMISSION_CODES: Record<ReferenceRole['code'], string[]> = {
  student: [
    'auth.profile.read',
    'mood.record.create',
    'mood.record.read',
    'mood.record.update',
    'mood.record.delete',
    'mood.advice.history.read',
    'post.create',
    'post.comment.create',
    'post.like',
    'activity.join',
    'questionnaire.read',
    'questionnaire.submit',
    'relax.record.manage',
    'achievement.read',
  ],
  counselor: [
    'auth.profile.read',
    'audit.record.view_all',
    'report.view',
    'feedback.handle',
    'mood.record.read',
    'questionnaire.submit',
  ],
  super_admin: [
    'auth.profile.read',
    'user.manage',
    'user.delete',
    'prompt.manage',
    'incident.fix',
    'audit.record.view_all',
    'post.audit',
    'post.audit.pending.read',
    'activity.manage',
    'course.manage',
    'music.manage',
    'report.view',
    'feedback.handle',
    'mood.record.read',
    'questionnaire.submit',
  ],
  admin: [
    'auth.profile.read',
    'post.audit.pending.read',
    'post.audit',
    'audit.record.view_all',
    'activity.manage',
    'course.manage',
    'music.manage',
    'report.view',
    'feedback.handle',
    'mood.record.read',
    'questionnaire.submit',
    'user.manage',
  ],
}

const REFERENCE_EMOTION_TYPES = [
  ['calm', '平静', 'calm', 'neutral', 10],
  ['happy', '快乐', 'smile', 'positive', 20],
  ['delight', '愉悦', 'sun', 'positive', 25],
  ['neutral', '一般', 'meh', 'neutral', 30],
  ['sad', '难过', 'cloud-rain', 'negative', 40],
  ['anxious', '焦虑', 'activity', 'negative', 50],
  ['angry', '愤怒', 'flame', 'negative', 60],
  ['irritable', '烦躁', 'zap', 'negative', 65],
  ['excited', '兴奋', 'star', 'positive', 70],
  ['tired', '疲惫', 'battery-low', 'neutral', 80],
] as const

const REFERENCE_SYSTEM_TAGS = [
  ['study', '学习'],
  ['relationship', '人际'],
  ['sleep', '睡眠'],
  ['exercise', '运动'],
  ['family', '家庭'],
  ['career', '职业规划'],
] as const

const nowSql = (): string => new Date().toISOString().slice(0, 23).replace('T', ' ')

export const seedReferenceData = async (db: SeedDatabase): Promise<ReferenceSeedResult> => {
  const now = nowSql()

  for (const role of REFERENCE_ROLES) {
    await db.query(
      `INSERT INTO roles (code, name, description, is_system, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_system = 1, updated_at = VALUES(updated_at)`,
      [role.code, role.name, role.description, now, now]
    )
  }

  for (const permission of REFERENCE_PERMISSIONS) {
    await db.query(
      `INSERT INTO permissions (code, name, description, created_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [permission.code, permission.name, permission.description, now]
    )
  }

  let rolePermissionCount = 0
  // 先清除旧的角色权限映射，确保与当前配置一致
  await db.query('DELETE FROM role_permissions')
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_CODES)) {
    for (const permissionCode of permissionCodes) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at)
         SELECT roles.id, permissions.id, ?
         FROM roles
         JOIN permissions ON permissions.code = ?
         WHERE roles.code = ?
         ON DUPLICATE KEY UPDATE created_at = role_permissions.created_at`,
        [now, permissionCode, roleCode]
      )
      rolePermissionCount += 1
    }
  }

  for (const [code, name, icon, category, sortOrder] of REFERENCE_EMOTION_TYPES) {
    await db.query(
      `INSERT INTO emotion_types (code, name, icon, category, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), category = VALUES(category), sort_order = VALUES(sort_order), is_active = 1`,
      [code, name, icon, category, sortOrder]
    )
  }

  for (const [code, name] of REFERENCE_SYSTEM_TAGS) {
    await db.query(
      `INSERT INTO tags (code, owner_user_id, name, is_system, created_at)
       VALUES (?, NULL, ?, 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_system = 1`,
      [code, name, now]
    )
  }

  return {
    roles: REFERENCE_ROLES.length,
    permissions: REFERENCE_PERMISSIONS.length,
    rolePermissions: rolePermissionCount,
    emotionTypes: REFERENCE_EMOTION_TYPES.length,
    systemTags: REFERENCE_SYSTEM_TAGS.length,
  }
}