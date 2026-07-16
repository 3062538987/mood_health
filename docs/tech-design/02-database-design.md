# 模块2：数据库设计文档

> 状态：已生效（基于代码现状）
> 日期：2026-07-16
> 版本：v1.0
> 数据库：MySQL 8.4.10
> 引擎：InnoDB
> 字符集：utf8mb4
> 排序规则：utf8mb4_unicode_ci

---

## 1. ER 关系说明

### 1.1 核心实体关系图

```
┌──────────┐       ┌──────────────┐       ┌─────────────────┐
│  roles   │───1:N──│    users     │───1:N──│  audit_logs     │
└──────────┘       └──────┬───────┘       └─────────────────┘
                          │
          ┌───────────────┼───────────────┬──────────────┐
          │ 1:N           │ 1:N           │ 1:N          │ 1:N
          ▼               ▼               ▼              ▼
    ┌──────────┐   ┌─────────────┐  ┌──────────┐  ┌──────────┐
    │  moods   │   │assessment_  │  │  cases   │  │  tags    │
    └────┬─────┘   │  sessions   │  └────┬─────┘  └──────────┘
         │         └──────┬──────┘       │
    ┌────┴────┐           │         ┌────┴────────────┐
    │ 1:N     │ 1:N       │ 1:N     │ 1:N              │
    ▼         ▼           ▼         ▼                  ▼
┌────────┐┌────────┐┌──────────┐┌──────────────┐
│  mood  ││  mood  ││assessment││    case       │
│emotions││  tags  ││  answers ││ interventions │
└───┬────┘└───┬────┘└────┬─────┘└──────────────┘
    │         │           │
    │ N:1     │ N:1       │ N:1
    ▼         ▼           ▼
┌────────┐┌────────┐┌──────────────┐
│emotion ││  tags  ││ assessment   │
│ types  ││        ││   items      │
└────────┘└────────┘└──────┬───────┘
                           │ N:1
                           ▼
                    ┌──────────────┐
                   │ assessment   │
                   │  versions    │
                    └──────┬───────┘
                           │ N:1
                           ▼
                    ┌──────────────┐
                   │ assessment   │
                   │ instruments  │
                    └──────────────┘

┌──────────┐   ┌──────────────┐   ┌─────────────────┐
│  roles   │───1:N──│role_permissions│───N:1──│ permissions     │
└──────────┘   └──────────────┘   └─────────────────┘

独立表: prompt_templates, schema_migrations
```

### 1.2 关系汇总

| 父表 | 子表 | 关系 | 外键 | 删除策略 |
|---|---|---|---|---|
| roles | users | 1:N | role_id | RESTRICT |
| roles | role_permissions | 1:N | role_id | CASCADE |
| permissions | role_permissions | 1:N | permission_id | CASCADE |
| users | moods | 1:N | user_id | CASCADE |
| users | tags | 1:N | owner_user_id | CASCADE |
| users | audit_logs | 1:N | actor_user_id | CASCADE |
| users | assessment_sessions | 1:N | user_id | CASCADE |
| users | cases (student) | 1:N | student_user_id | RESTRICT |
| users | cases (counselor) | 1:N | assigned_counselor_id | SET NULL |
| users | case_interventions | 1:N | counselor_user_id | RESTRICT |
| moods | mood_emotions | 1:N | mood_id | CASCADE |
| moods | mood_tags | 1:N | mood_id | CASCADE |
| emotion_types | mood_emotions | 1:N | emotion_type_id | RESTRICT |
| tags | mood_tags | 1:N | tag_id | CASCADE |
| assessment_instruments | assessment_versions | 1:N | instrument_id | RESTRICT |
| assessment_versions | assessment_items | 1:N | assessment_version_id | CASCADE |
| assessment_versions | assessment_sessions | 1:N | assessment_version_id | RESTRICT |
| assessment_sessions | assessment_answers | 1:N | session_id | CASCADE |
| assessment_sessions | cases | 1:N | source_session_id | SET NULL |
| assessment_items | assessment_answers | 1:N | item_id | RESTRICT |
| cases | case_interventions | 1:N | case_id | CASCADE |

### 1.3 数据安全设计要点

- **敏感字段加密**：`moods.note_ciphertext` 和 `moods.trigger_ciphertext` 使用 AES-256-GCM 加密存储，密钥由环境变量 `ENCRYPTION_KEY` 提供
- **密码存储**：`users.password_hash` 使用 bcrypt (cost=12) 哈希
- **级联删除**：用户删除时自动清理 moods、tags、audit_logs、assessment_sessions（含 answers）
- **删除保护**：roles（系统角色）、assessment_instruments、assessment_versions、emotion_types 使用 RESTRICT 防止误删
- **用户删除阻断**：若用户关联了 open 状态 case 或 pending 状态干预，通过 ON DELETE RESTRICT 阻止删除

---

## 2. 数据表清单

### 2.1 表名汇总

| 序号 | 表名 | 中文名 | 存储引擎 | 字符集 | 记录数预估 |
|---|---|---|---|---|---|
| 1 | `schema_migrations` | 迁移版本记录 | InnoDB | utf8mb4 | < 100 |
| 2 | `roles` | 角色 | InnoDB | utf8mb4 | < 10 |
| 3 | `permissions` | 权限 | InnoDB | utf8mb4 | < 50 |
| 4 | `role_permissions` | 角色-权限关联 | InnoDB | utf8mb4 | < 200 |
| 5 | `users` | 用户 | InnoDB | utf8mb4 | < 10万 |
| 6 | `audit_logs` | 审计日志 | InnoDB | utf8mb4 | 无上限 |
| 7 | `emotion_types` | 情绪类型 | InnoDB | utf8mb4 | < 50 |
| 8 | `tags` | 标签 | InnoDB | utf8mb4 | < 1万 |
| 9 | `moods` | 情绪记录 | InnoDB | utf8mb4 | < 100万 |
| 10 | `mood_emotions` | 情绪记录-情绪关联 | InnoDB | utf8mb4 | < 500万 |
| 11 | `mood_tags` | 情绪记录-标签关联 | InnoDB | utf8mb4 | < 100万 |
| 12 | `assessment_instruments` | 测评工具 | InnoDB | utf8mb4 | < 10 |
| 13 | `assessment_versions` | 测评版本 | InnoDB | utf8mb4 | < 50 |
| 14 | `assessment_items` | 测评题目 | InnoDB | utf8mb4 | < 1000 |
| 15 | `assessment_sessions` | 测评会话 | InnoDB | utf8mb4 | < 100万 |
| 16 | `assessment_answers` | 测评答案 | InnoDB | utf8mb4 | < 5000万 |
| 17 | `cases` | 风险个案 | InnoDB | utf8mb4 | < 1万 |
| 18 | `case_interventions` | 个案干预记录 | InnoDB | utf8mb4 | < 10万 |
| 19 | `prompt_templates` | Prompt 模板 | InnoDB | utf8mb4 | < 100 |

### 2.2 详细字段定义

---

#### 2.2.1 schema_migrations — 迁移版本记录

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| version | VARCHAR | 255 | YES | — | 迁移版本号 | PRIMARY KEY |
| name | VARCHAR | 255 | YES | — | 迁移名称 | — |
| checksum | VARCHAR | 64 | NO | NULL | 文件校验和 | — |
| execution_ms | INT UNSIGNED | — | NO | NULL | 执行耗时(ms) | — |
| applied_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 应用时间 | — |

---

#### 2.2.2 roles — 角色

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 角色ID | PRIMARY KEY |
| code | VARCHAR | 50 | YES | — | 角色编码 | UNIQUE |
| name | VARCHAR | 100 | YES | — | 角色名称 | — |
| description | VARCHAR | 255 | NO | NULL | 角色描述 | — |
| is_system | TINYINT(1) | — | YES | 0 | 是否系统角色 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

**系统角色种子数据**（代码中定义）：

| code | name | 说明 |
|---|---|---|
| super_admin | 超级管理员 | 拥有全部权限 |
| admin | 管理员 | 管理权限 |
| counselor | 咨询师 | 个案管理权限 |
| student | 学生 | 基础用户 |

---

#### 2.2.3 permissions — 权限

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 权限ID | PRIMARY KEY |
| code | VARCHAR | 50 | YES | — | 权限编码 | UNIQUE |
| name | VARCHAR | 100 | YES | — | 权限名称 | — |
| description | VARCHAR | 255 | NO | NULL | 权限描述 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

**编码规范**：权限编码使用 `resource.action` 格式，如 `mood.read`、`case.update`。

---

#### 2.2.4 role_permissions — 角色-权限关联

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| role_id | INT UNSIGNED | — | YES | — | 角色ID | PRIMARY KEY (联合) |
| permission_id | INT UNSIGNED | — | YES | — | 权限ID | PRIMARY KEY (联合) |
| created_at | DATETIME(3) | — | YES | — | 创建时间 | — |

外键：`role_id` → `roles.id` ON DELETE CASCADE，`permission_id` → `permissions.id` ON DELETE CASCADE

---

#### 2.2.5 users — 用户

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 用户ID | PRIMARY KEY |
| role_id | INT UNSIGNED | — | YES | — | 角色ID | INDEX, FK→roles.id |
| username | VARCHAR | 50 | YES | — | 用户名 | UNIQUE |
| password_hash | VARCHAR | 255 | YES | — | 密码哈希(bcrypt) | — |
| email | VARCHAR | 255 | NO | NULL | 邮箱 | — |
| nickname | VARCHAR | 100 | NO | NULL | 昵称 | — |
| avatar_url | VARCHAR | 500 | NO | NULL | 头像URL | — |
| status | VARCHAR | 20 | YES | 'active' | 状态 | — |
| last_login_at | DATETIME(3) | — | NO | NULL | 最后登录时间 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

外键：`role_id` → `roles.id` ON DELETE RESTRICT

---

#### 2.2.6 audit_logs — 审计日志

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 日志ID | PRIMARY KEY |
| actor_user_id | INT UNSIGNED | — | YES | — | 操作人ID | INDEX, FK→users.id |
| actor_role_code | VARCHAR | 50 | YES | — | 操作人角色编码 | — |
| permission_code | VARCHAR | 50 | NO | NULL | 所需权限编码 | — |
| action | VARCHAR | 100 | YES | — | 操作动作 | INDEX |
| target_type | VARCHAR | 50 | NO | NULL | 目标类型 | — |
| target_id | INT UNSIGNED | — | NO | NULL | 目标ID | — |
| result | VARCHAR | 20 | YES | — | 操作结果 | — |
| summary | TEXT | — | NO | NULL | 操作摘要 | — |
| ip_address | VARCHAR | 45 | NO | NULL | 客户端IP | — |
| request_id | CHAR | 36 | NO | NULL | 请求ID(UUID) | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | INDEX |

外键：`actor_user_id` → `users.id` ON DELETE CASCADE

---

#### 2.2.7 emotion_types — 情绪类型

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 情绪类型ID | PRIMARY KEY |
| code | VARCHAR | 50 | YES | — | 情绪编码 | UNIQUE |
| name | VARCHAR | 100 | YES | — | 情绪名称 | — |
| icon | VARCHAR | 10 | NO | NULL | 图标(emoji) | — |
| category | VARCHAR | 50 | YES | — | 分类 | INDEX |
| sort_order | INT UNSIGNED | — | YES | 0 | 排序 | INDEX |
| is_active | TINYINT(1) | — | YES | 1 | 是否启用 | — |

---

#### 2.2.8 tags — 标签

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 标签ID | PRIMARY KEY |
| code | VARCHAR | 50 | YES | — | 标签编码 | UNIQUE (联合 code+owner) |
| owner_user_id | INT UNSIGNED | — | NO | NULL | 所属用户ID | INDEX, FK→users.id |
| name | VARCHAR | 100 | YES | — | 标签名称 | — |
| is_system | TINYINT(1) | — | YES | 0 | 是否系统标签 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

外键：`owner_user_id` → `users.id` ON DELETE CASCADE
唯一键：`uk_tags_code_owner` (code, owner_user_id)

---

#### 2.2.9 moods — 情绪记录

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 记录ID | PRIMARY KEY |
| user_id | INT UNSIGNED | — | YES | — | 用户ID | INDEX, FK→users.id |
| note_ciphertext | VARCHAR | 2000 | NO | NULL | 备注密文(AES-256-GCM) | — |
| trigger_ciphertext | TEXT | — | NO | NULL | 触发因素密文(AES-256-GCM) | — |
| recorded_at | DATETIME(3) | — | YES | — | 记录时间 | INDEX |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

外键：`user_id` → `users.id` ON DELETE CASCADE

---

#### 2.2.10 mood_emotions — 情绪记录-情绪关联

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| mood_id | INT UNSIGNED | — | YES | — | 情绪记录ID | PRIMARY KEY (联合) |
| emotion_type_id | INT UNSIGNED | — | YES | — | 情绪类型ID | PRIMARY KEY (联合) |
| intensity | SMALLINT UNSIGNED | — | YES | — | 强度(1-10) | CHECK |
| is_primary | TINYINT(1) | — | YES | 0 | 是否主要情绪 | — |

- CHECK 约束：`intensity >= 1 AND intensity <= 10`
- 外键：`mood_id` → `moods.id` ON DELETE CASCADE，`emotion_type_id` → `emotion_types.id` ON DELETE RESTRICT

---

#### 2.2.11 mood_tags — 情绪记录-标签关联

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| mood_id | INT UNSIGNED | — | YES | — | 情绪记录ID | PRIMARY KEY (联合) |
| tag_id | INT UNSIGNED | — | YES | — | 标签ID | PRIMARY KEY (联合) |

外键：`mood_id` → `moods.id` ON DELETE CASCADE，`tag_id` → `tags.id` ON DELETE CASCADE

---

#### 2.2.12 assessment_instruments — 测评工具

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 工具ID | PRIMARY KEY |
| code | VARCHAR | 50 | YES | — | 工具编码 | UNIQUE |
| name | VARCHAR | 200 | YES | — | 工具名称 | — |
| description | TEXT | — | NO | NULL | 工具描述 | — |
| status | VARCHAR | 20 | YES | 'active' | 状态 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

---

#### 2.2.13 assessment_versions — 测评版本

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 版本ID | PRIMARY KEY |
| instrument_id | INT UNSIGNED | — | YES | — | 工具ID | FK→assessment_instruments.id |
| version_label | VARCHAR | 50 | YES | — | 版本标签 | UNIQUE (联合 instrument+version) |
| language | VARCHAR | 10 | YES | 'zh-CN' | 语言 | — |
| target_population | VARCHAR | 200 | NO | NULL | 适用人群 | — |
| theoretical_basis | TEXT | — | NO | NULL | 理论依据 | — |
| source_citation | TEXT | — | NO | NULL | 引用来源 | — |
| license_note | TEXT | — | NO | NULL | 版权说明 | — |
| scoring_rule_json | JSON | — | YES | — | 计分规则(JSON) | — |
| risk_stratification_json | JSON | — | YES | — | 风险分层(JSON) | — |
| suggestion_template_json | JSON | — | YES | — | 建议模板(JSON) | — |
| status | VARCHAR | 20 | YES | 'draft' | 状态 | INDEX |
| checksum | CHAR | 64 | YES | — | 版本校验和(SHA-256) | — |
| published_at | DATETIME(3) | — | NO | NULL | 发布时间 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

外键：`instrument_id` → `assessment_instruments.id` ON DELETE RESTRICT
唯一键：`uk_assessment_versions_instrument_version` (instrument_id, version_label)

---

#### 2.2.14 assessment_items — 测评题目

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 题目ID | PRIMARY KEY |
| assessment_version_id | INT UNSIGNED | — | YES | — | 版本ID | INDEX, FK→assessment_versions.id |
| item_order | INT UNSIGNED | — | YES | — | 题目序号 | — |
| item_text | TEXT | — | YES | — | 题目文本 | — |
| item_type | VARCHAR | 20 | YES | — | 题目类型 | CHECK |
| options_json | JSON | — | NO | NULL | 选项(JSON) | — |
| reverse_scored | TINYINT(1) | — | YES | 0 | 是否反向计分 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

- CHECK 约束：`item_type IN ('single_choice', 'multiple_choice', 'text')`
- 外键：`assessment_version_id` → `assessment_versions.id` ON DELETE CASCADE

---

#### 2.2.15 assessment_sessions — 测评会话

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 会话ID | PRIMARY KEY |
| user_id | INT UNSIGNED | — | YES | — | 用户ID | INDEX, FK→users.id |
| assessment_version_id | INT UNSIGNED | — | YES | — | 版本ID | INDEX, FK→assessment_versions.id |
| raw_score | INT | — | NO | NULL | 原始得分 | — |
| screening_level | VARCHAR | 30 | NO | NULL | 筛查等级 | — |
| result_summary_json | JSON | — | NO | NULL | 结果摘要(JSON) | — |
| status | VARCHAR | 20 | YES | 'started' | 状态 | INDEX, CHECK |
| started_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 开始时间 | — |
| submitted_at | DATETIME(3) | — | NO | NULL | 提交时间 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

- CHECK 约束：`status IN ('started', 'submitted', 'voided')`
- 外键：`user_id` → `users.id` ON DELETE CASCADE，`assessment_version_id` → `assessment_versions.id` ON DELETE RESTRICT

---

#### 2.2.16 assessment_answers — 测评答案

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 答案ID | PRIMARY KEY |
| session_id | INT UNSIGNED | — | YES | — | 会话ID | INDEX, FK→assessment_sessions.id |
| item_id | INT UNSIGNED | — | YES | — | 题目ID | FK→assessment_items.id |
| answer_value_json | JSON | — | YES | — | 答案值(JSON) | — |
| score | INT | — | NO | NULL | 得分 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

外键：`session_id` → `assessment_sessions.id` ON DELETE CASCADE，`item_id` → `assessment_items.id` ON DELETE RESTRICT

---

#### 2.2.17 cases — 风险个案

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 个案ID | PRIMARY KEY |
| student_user_id | INT UNSIGNED | — | YES | — | 学生用户ID | INDEX, FK→users.id |
| assigned_counselor_id | INT UNSIGNED | — | NO | NULL | 指派咨询师ID | INDEX, FK→users.id |
| source_session_id | INT UNSIGNED | — | NO | NULL | 来源会话ID | FK→assessment_sessions.id |
| status | VARCHAR | 30 | YES | 'open' | 状态 | INDEX, CHECK |
| risk_level | VARCHAR | 30 | YES | 'medium' | 风险等级 | INDEX |
| summary | TEXT | — | NO | NULL | 个案摘要 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

- CHECK 约束：`status IN ('open', 'assigned', 'closed')`
- 外键：`student_user_id` → `users.id` ON DELETE RESTRICT，`assigned_counselor_id` → `users.id` ON DELETE SET NULL，`source_session_id` → `assessment_sessions.id` ON DELETE SET NULL

---

#### 2.2.18 case_interventions — 个案干预记录

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 干预ID | PRIMARY KEY |
| case_id | INT UNSIGNED | — | YES | — | 个案ID | INDEX, FK→cases.id |
| counselor_user_id | INT UNSIGNED | — | YES | — | 咨询师ID | FK→users.id |
| intervention_type | VARCHAR | 50 | YES | — | 干预类型 | CHECK |
| content | TEXT | — | NO | NULL | 干预内容 | — |
| referral_target | VARCHAR | 100 | NO | NULL | 转介目标 | — |
| referral_reason | TEXT | — | NO | NULL | 转介原因 | — |
| closure_summary | TEXT | — | NO | NULL | 结案总结 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |

- CHECK 约束：`intervention_type IN ('note', 'referral', 'closure')`
- 外键：`case_id` → `cases.id` ON DELETE CASCADE，`counselor_user_id` → `users.id` ON DELETE RESTRICT

---

#### 2.2.19 prompt_templates — Prompt 模板

| 字段名 | 类型 | 长度 | 非空 | 默认值 | 注释 | 键/索引 |
|---|---|---|---|---|---|---|
| id | INT UNSIGNED | — | YES | AUTO_INCREMENT | 模板ID | PRIMARY KEY |
| name | VARCHAR | 200 | YES | — | 模板名称 | — |
| category | VARCHAR | 50 | YES | — | 分类 | INDEX |
| system_prompt | TEXT | — | NO | NULL | 系统提示词 | — |
| user_prompt_template | TEXT | — | YES | — | 用户提示词模板 | — |
| variables | JSON | — | YES | — | 变量定义(JSON) | — |
| model | VARCHAR | 100 | NO | 'gpt-4o' | 模型名称 | — |
| temperature | DECIMAL(3,2) | — | NO | 0.70 | 温度参数 | — |
| max_tokens | INT UNSIGNED | — | NO | 2048 | 最大Token数 | — |
| is_active | TINYINT(1) | — | YES | 1 | 是否启用 | INDEX |
| sort_order | INT UNSIGNED | — | YES | 0 | 排序 | — |
| created_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) | 创建时间 | — |
| updated_at | DATETIME(3) | — | YES | UTC_TIMESTAMP(3) ON UPDATE | 更新时间 | — |

---

## 3. 枚举常量统一定义

### 3.1 用户状态 (users.status)

| 值 | 含义 |
|---|---|
| `active` | 正常 |
| `disabled` | 已禁用 |

### 3.2 角色编码 (roles.code)

| 值 | 含义 |
|---|---|
| `super_admin` | 超级管理员 |
| `admin` | 管理员 |
| `counselor` | 咨询师 |
| `student` | 学生 |

### 3.3 测评工具状态 (assessment_instruments.status)

| 值 | 含义 |
|---|---|
| `active` | 启用 |
| `deprecated` | 废弃 |

### 3.4 测评版本状态 (assessment_versions.status)

| 值 | 含义 |
|---|---|
| `draft` | 草稿 |
| `published` | 已发布 |
| `deprecated` | 废弃 |

### 3.5 测评题目类型 (assessment_items.item_type)

| 值 | 含义 |
|---|---|
| `single_choice` | 单选题 |
| `multiple_choice` | 多选题 |
| `text` | 文本题 |

### 3.6 测评会话状态 (assessment_sessions.status)

| 值 | 含义 |
|---|---|
| `started` | 已开始 |
| `submitted` | 已提交 |
| `voided` | 已作废 |

### 3.7 个案状态 (cases.status)

| 值 | 含义 |
|---|---|
| `open` | 待处理 |
| `assigned` | 已指派 |
| `closed` | 已结案 |

### 3.8 个案风险等级 (cases.risk_level)

| 值 | 含义 |
|---|---|
| `low` | 低风险 |
| `medium` | 中风险 |
| `high` | 高风险 |

### 3.9 干预类型 (case_interventions.intervention_type)

| 值 | 含义 |
|---|---|
| `note` | 备注 |
| `referral` | 转介 |
| `closure` | 结案 |

### 3.10 审计操作结果 (audit_logs.result)

| 值 | 含义 |
|---|---|
| `success` | 成功 |
| `failure` | 失败 |

### 3.11 情绪分类 (emotion_types.category)

| 值 | 含义 |
|---|---|
| `positive` | 积极情绪 |
| `negative` | 消极情绪 |
| `neutral` | 中性情绪 |

### 3.12 Prompt 模板分类 (prompt_templates.category)

| 值 | 含义 |
|---|---|
| `assessment_interpretation` | 测评解读 |
| `mood_report` | 情绪报告 |
| `intervention_suggestion` | 干预建议 |

---

## 4. 完整 DDL 建表语句

以下为可直接在 MySQL 8.4 中执行的完整建表语句，与代码迁移文件完全一致。

```sql
-- ============================================================
-- 数据库: mood_health (MySQL 8.4.10)
-- 字符集: utf8mb4 / utf8mb4_unicode_ci
-- 引擎: InnoDB
-- 生成日期: 2026-07-16
-- 基于: mood_health_server/src/db/migrations/*.up.sql
-- ============================================================

-- 1. 迁移版本记录
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NULL,
    execution_ms INT UNSIGNED NULL,
    applied_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 角色
CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    UNIQUE KEY uk_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 权限
CREATE TABLE IF NOT EXISTS permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uk_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 角色-权限关联
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 用户
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    nickname VARCHAR(100) NULL,
    avatar_url VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    UNIQUE KEY uk_users_username (username),
    INDEX idx_users_role_id (role_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT UNSIGNED NOT NULL,
    actor_role_code VARCHAR(50) NOT NULL,
    permission_code VARCHAR(50) NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id INT UNSIGNED NULL,
    result VARCHAR(20) NOT NULL,
    summary TEXT NULL,
    ip_address VARCHAR(45) NULL,
    request_id CHAR(36) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX idx_audit_logs_actor_user_id (actor_user_id),
    INDEX idx_audit_logs_created_at (created_at),
    INDEX idx_audit_logs_action (action),
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. 情绪类型
CREATE TABLE IF NOT EXISTS emotion_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NULL,
    category VARCHAR(50) NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uk_emotion_types_code (code),
    INDEX idx_emotion_types_category (category),
    INDEX idx_emotion_types_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 标签
CREATE TABLE IF NOT EXISTS tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    owner_user_id INT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uk_tags_code_owner (code, owner_user_id),
    INDEX idx_tags_owner_user_id (owner_user_id),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 情绪记录
CREATE TABLE IF NOT EXISTS moods (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    note_ciphertext VARCHAR(2000) NULL,
    trigger_ciphertext TEXT NULL,
    recorded_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    INDEX idx_moods_user_id (user_id),
    INDEX idx_moods_recorded_at (recorded_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 情绪记录-情绪关联
CREATE TABLE IF NOT EXISTS mood_emotions (
    mood_id INT UNSIGNED NOT NULL,
    emotion_type_id INT UNSIGNED NOT NULL,
    intensity SMALLINT UNSIGNED NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (mood_id, emotion_type_id),
    CONSTRAINT chk_mood_emotions_intensity CHECK (intensity >= 1 AND intensity <= 10),
    FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
    FOREIGN KEY (emotion_type_id) REFERENCES emotion_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. 情绪记录-标签关联
CREATE TABLE IF NOT EXISTS mood_tags (
    mood_id INT UNSIGNED NOT NULL,
    tag_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (mood_id, tag_id),
    FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. 测评工具
CREATE TABLE IF NOT EXISTS assessment_instruments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    UNIQUE KEY uk_assessment_instruments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. 测评版本
CREATE TABLE IF NOT EXISTS assessment_versions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    instrument_id INT UNSIGNED NOT NULL,
    version_label VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'zh-CN',
    target_population VARCHAR(200) NULL,
    theoretical_basis TEXT NULL,
    source_citation TEXT NULL,
    license_note TEXT NULL,
    scoring_rule_json JSON NOT NULL,
    risk_stratification_json JSON NOT NULL,
    suggestion_template_json JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    checksum CHAR(64) NOT NULL,
    published_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    UNIQUE KEY uk_assessment_versions_instrument_version (instrument_id, version_label),
    INDEX idx_assessment_versions_status (status),
    FOREIGN KEY (instrument_id) REFERENCES assessment_instruments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. 测评题目
CREATE TABLE IF NOT EXISTS assessment_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_version_id INT UNSIGNED NOT NULL,
    item_order INT UNSIGNED NOT NULL,
    item_text TEXT NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    options_json JSON NULL,
    reverse_scored TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    CONSTRAINT chk_assessment_items_item_type CHECK (item_type IN ('single_choice', 'multiple_choice', 'text')),
    INDEX idx_assessment_items_version_id (assessment_version_id),
    FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. 测评会话
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    assessment_version_id INT UNSIGNED NOT NULL,
    raw_score INT NULL,
    screening_level VARCHAR(30) NULL,
    result_summary_json JSON NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'started',
    started_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    submitted_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    CONSTRAINT chk_assessment_sessions_status CHECK (status IN ('started', 'submitted', 'voided')),
    INDEX idx_assessment_sessions_user_id (user_id),
    INDEX idx_assessment_sessions_version_id (assessment_version_id),
    INDEX idx_assessment_sessions_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. 测评答案
CREATE TABLE IF NOT EXISTS assessment_answers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    answer_value_json JSON NOT NULL,
    score INT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX idx_assessment_answers_session_id (session_id),
    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES assessment_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. 风险个案
CREATE TABLE IF NOT EXISTS cases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT UNSIGNED NOT NULL,
    assigned_counselor_id INT UNSIGNED NULL,
    source_session_id INT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    risk_level VARCHAR(30) NOT NULL DEFAULT 'medium',
    summary TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    CONSTRAINT chk_cases_status CHECK (status IN ('open', 'assigned', 'closed')),
    INDEX idx_cases_student_user_id (student_user_id),
    INDEX idx_cases_assigned_counselor_id (assigned_counselor_id),
    INDEX idx_cases_status (status),
    INDEX idx_cases_risk_level (risk_level),
    FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_counselor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (source_session_id) REFERENCES assessment_sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. 个案干预记录
CREATE TABLE IF NOT EXISTS case_interventions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id INT UNSIGNED NOT NULL,
    counselor_user_id INT UNSIGNED NOT NULL,
    intervention_type VARCHAR(50) NOT NULL,
    content TEXT NULL,
    referral_target VARCHAR(100) NULL,
    referral_reason TEXT NULL,
    closure_summary TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    CONSTRAINT chk_case_interventions_intervention_type CHECK (intervention_type IN ('note', 'referral', 'closure')),
    INDEX idx_case_interventions_case_id (case_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (counselor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Prompt 模板
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    system_prompt TEXT NULL,
    user_prompt_template TEXT NOT NULL,
    variables JSON NOT NULL,
    model VARCHAR(100) NULL DEFAULT 'gpt-4o',
    temperature DECIMAL(3,2) NULL DEFAULT 0.70,
    max_tokens INT UNSIGNED NULL DEFAULT 2048,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
    INDEX idx_prompt_templates_category (category),
    INDEX idx_prompt_templates_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. 索引设计说明

| 表 | 索引名 | 索引字段 | 索引类型 | 目的 |
|---|---|---|---|---|
| users | uk_users_username | username | UNIQUE | 登录唯一性 |
| users | idx_users_role_id | role_id | INDEX | 按角色筛选用户 |
| audit_logs | idx_audit_logs_actor_user_id | actor_user_id | INDEX | 按操作人查询日志 |
| audit_logs | idx_audit_logs_created_at | created_at | INDEX | 按时间范围查询日志 |
| audit_logs | idx_audit_logs_action | action | INDEX | 按操作类型筛选 |
| emotion_types | idx_emotion_types_category | category | INDEX | 按分类筛选情绪 |
| emotion_types | idx_emotion_types_sort_order | sort_order | INDEX | 按排序加载 |
| tags | uk_tags_code_owner | (code, owner_user_id) | UNIQUE | 同一用户标签编码唯一性 |
| tags | idx_tags_owner_user_id | owner_user_id | INDEX | 按用户查询标签 |
| moods | idx_moods_user_id | user_id | INDEX | 按用户查询情绪 |
| moods | idx_moods_recorded_at | recorded_at | INDEX | 按时间范围查询 |
| assessment_versions | idx_assessment_versions_status | status | INDEX | 按状态筛选版本 |
| assessment_items | idx_assessment_items_version_id | assessment_version_id | INDEX | 按版本加载题目 |
| assessment_sessions | idx_assessment_sessions_user_id | user_id | INDEX | 按用户查询会话 |
| assessment_sessions | idx_assessment_sessions_version_id | assessment_version_id | INDEX | 按版本查询会话 |
| assessment_sessions | idx_assessment_sessions_status | status | INDEX | 按状态筛选 |
| assessment_answers | idx_assessment_answers_session_id | session_id | INDEX | 按会话加载答案 |
| cases | idx_cases_student_user_id | student_user_id | INDEX | 按学生查询个案 |
| cases | idx_cases_assigned_counselor_id | assigned_counselor_id | INDEX | 按咨询师查询个案 |
| cases | idx_cases_status | status | INDEX | 按状态筛选 |
| cases | idx_cases_risk_level | risk_level | INDEX | 按风险等级筛选 |
| case_interventions | idx_case_interventions_case_id | case_id | INDEX | 按个案查询干预 |
| prompt_templates | idx_prompt_templates_category | category | INDEX | 按分类加载模板 |
| prompt_templates | idx_prompt_templates_is_active | is_active | INDEX | 按启用状态筛选 |

---

## 6. 已下线表清单

以下表在 R0 重构中已确认删除（代码中已移除相关迁移）：

| 表名 | 原用途 | 下线原因 |
|---|---|---|
| `incident_fix_list` | 事件修复记录 | 纳入统一审计日志体系 |
| `feedback_close_list` | 反馈关闭记录 | 纳入统一审计日志体系 |

> ⚠️ **风险备注**：`managementController.ts` 中仍存在 `incidentFixHandler` 和 `feedbackHandleHandler` 两个路由处理函数，但对应数据库表已删除。这些接口当前返回 200 假成功响应，需确认是保留为占位接口还是彻底移除路由。