export interface SeedDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface ReferenceRole {
  code: 'student' | 'counselor' | 'super_admin'
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
]

export const ROLE_PERMISSION_CODES: Record<ReferenceRole['code'], string[]> = {
  student: [
    'auth.profile.read',
    'mood.record.create',
    'mood.record.read_own',
    'mood.record.update_own',
    'mood.record.delete_own',
    'assessment.instrument.read',
    'assessment.submit',
    'assessment.history.read_own',
  ],
  counselor: ['auth.profile.read', 'report.aggregate.read'],
  super_admin: ['auth.profile.read', 'report.aggregate.read', 'user.manage', 'user.role.assign', 'audit.log.read'],
}

const REFERENCE_EMOTION_TYPES = [
  ['calm', '平静', 'calm', 'neutral', 10],
  ['happy', '愉快', 'smile', 'positive', 20],
  ['sad', '低落', 'cloud-rain', 'negative', 30],
  ['anxious', '焦虑', 'activity', 'negative', 40],
  ['angry', '烦躁', 'flame', 'negative', 50],
  ['tired', '疲惫', 'battery-low', 'neutral', 60],
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
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_CODES)) {
    for (const permissionCode of permissionCodes) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at)
         SELECT roles.id, permissions.id, ?
         FROM roles
         JOIN permissions ON permissions.code = ?
         WHERE roles.code = ?
         ON DUPLICATE KEY UPDATE created_at = created_at`,
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
