# 模块5：开发约束总则

> 状态：已生效
> 日期：2026-07-16
> 版本：v1.0
> 适用：所有新增代码、存量代码整改

---

## 1. 总体约束矩阵

| 约束编号 | 类别 | 约束内容 | 违规后果 |
|---|---|---|---|
| C-01 | 数据库 | 严格遵循本文档数据库结构，不私自新增/删减字段 | 迁移失败、数据不一致 |
| C-02 | 数据库 | 所有表结构变更必须通过迁移文件（.up.sql）执行 | 无法回滚、环境不一致 |
| C-03 | 数据库 | SQL 兼容 MySQL 8.4，不使用高版本特有语法 | 数据库升级困难 |
| C-04 | API | 所有接口强制遵守统一 API 返回契约（模块3） | 前端解析失败 |
| C-05 | API | 新接口 URL 遵循 kebab-case 小写复数命名 | 路由不一致 |
| C-06 | API | 分页查询统一使用 page/pageSize 参数 | 前后端不一致 |
| C-07 | 架构 | 后端代码严格使用 Controller → Service → Repository 分层 | 代码耦合、难以测试 |
| C-08 | 架构 | 禁止跨层调用（Controller 不调 Repository） | 打破分层边界 |
| C-09 | 架构 | Repository 是唯一数据访问边界 | 数据访问分散 |
| C-10 | 命名 | 实体、数据表、接口保持文档定义名称 | 命名混乱 |
| C-11 | 命名 | 数据库 snake_case，TypeScript camelCase，映射由 Repository 负责 | 命名不一致 |
| C-12 | 安全 | 敏感字段（note, trigger）必须 AES-256-GCM 加密 | 数据泄露 |
| C-13 | 安全 | 密码必须 bcrypt 哈希，不存储明文 | 账户安全 |
| C-14 | 安全 | SQL 参数化查询，禁止拼接用户输入 | SQL 注入 |
| C-15 | 测试 | 所有新 Repository 方法必须有对应单元测试 | 回归风险 |
| C-16 | 测试 | 所有新 API 接口必须有集成测试 | 接口不可靠 |

---

## 2. 数据库开发约束

### 2.1 表结构变更流程

```
1. 创建迁移文件: src/db/migrations/XXXX_description.up.sql
2. 编写 DDL（使用 MySQL 8.4 兼容语法）
3. 运行 npm run db:migrate 验证
4. 更新本文档模块2中对应表定义
5. 提交迁移文件 + 文档更新
```

### 2.2 字段新增规则

| 规则 | 说明 |
|---|---|
| 新字段必须有默认值 | 避免现有行数据出现 NULL 异常 |
| 不允许删除字段 | 只能标记废弃，通过迁移新增替代字段 |
| 字段类型兼容 | 不在已有字段上修改类型（如 VARCHAR→TEXT 除外） |
| 外键必须有 ON DELETE 策略 | 明确 CASCADE / RESTRICT / SET NULL |

### 2.3 索引新增规则

- 新增索引前评估查询频率和选择性
- 联合索引遵循最左前缀原则
- 不在低基数列（如 `status`）上建单列索引（除非查询频繁）
- 索引命名：`idx_{table}_{column}`

### 2.4 禁止事项

- ❌ 禁止在应用代码中执行 DDL（ALTER TABLE、CREATE TABLE 等）
- ❌ 禁止使用 `SELECT *`
- ❌ 禁止在 WHERE 子句中对列使用函数（如 `WHERE YEAR(created_at) = 2026`）
- ❌ 禁止在应用层进行大批量循环单条 INSERT

---

## 3. 后端开发约束

### 3.1 Controller 层约束

```typescript
// 正确示例
export const createMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    // 1. 提取参数
    const { emotions, tags, note, trigger, recordedAt } = req.body;
    // 2. 调用 Service
    const result = await moodService.recordMood(userId, { emotions, tags, note, trigger, recordedAt });
    // 3. 组装统一响应
    return res.status(201).json(apiSuccess(result, '情绪记录创建成功'));
  } catch (error) {
    // 4. 错误处理（交给全局错误中间件或手动处理）
    if (error instanceof BusinessError) {
      return res.status(error.httpStatus).json(apiFailure(error.code, error.message));
    }
    return res.status(500).json(apiFailure(89999, '服务器内部错误'));
  }
};
```

**约束清单**：
- 必须使用 `apiSuccess()` / `apiFailure()` 构造响应
- 禁止直接 `res.json({ code: 0, data: ... })` 格式
- 禁止导入 `mysql2` 或直接操作数据库
- 禁止在 Controller 中写业务逻辑

### 3.2 Service 层约束

```typescript
// 正确示例
export const recordMood = async (userId: number, input: MoodInput): Promise<MoodRecord> => {
  // 1. 参数校验
  if (!input.emotions || input.emotions.length === 0) {
    throw new BusinessError(30001, '至少选择一个情绪');
  }
  // 2. 加密敏感数据
  const noteCiphertext = input.note ? encrypt(input.note) : null;
  const triggerCiphertext = input.trigger ? encrypt(input.trigger) : null;
  // 3. 调用 Repository（事务）
  const db = await getMysqlPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const moodId = await moodRepo.createMood(connection, { userId, noteCiphertext, triggerCiphertext, recordedAt });
    await moodRepo.createMoodEmotions(connection, moodId, input.emotions);
    await connection.commit();
    return moodRepo.findMoodById(moodId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
```

**约束清单**：
- 禁止直接导入 `mysql2` 或执行 SQL
- 事务管理在 Service 层，Repository 接受 `connection` 参数
- 加密/解密在 Service 层完成
- 业务异常使用 `BusinessError` 抛出

### 3.3 Repository 层约束

```typescript
// 正确示例
const mapMoodRow = (row: RowDataPacket): MoodRecord => ({
  id: row.id,
  userId: row.user_id,
  note: row.note_ciphertext, // Service 层负责解密
  trigger: row.trigger_ciphertext,
  recordedAt: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export const createMoodRepository = (db?: Pool) => {
  const pool = db ?? getMysqlPool();
  return {
    async createMood(connection: PoolConnection, input: CreateMoodInput): Promise<number> {
      const [result] = await connection.execute(
        `INSERT INTO moods (user_id, note_ciphertext, trigger_ciphertext, recorded_at)
         VALUES (?, ?, ?, ?)`,
        [input.userId, input.noteCiphertext, input.triggerCiphertext, input.recordedAt]
      );
      return (result as any).insertId;
    },
    // ...
  };
};
```

**约束清单**：
- 必须使用参数化占位符 `?`
- 必须显式列出所有字段，禁止 `SELECT *`
- 返回领域对象，不返回 `RowDataPacket`
- 内部定义 `mapXxx()` 行映射函数
- 时间写入使用 `UTC_TIMESTAMP(3)`，读时转为 ISO 字符串

### 3.4 路由层约束

```typescript
// 正确示例
router.post(
  '/record',
  authenticate,
  validateRequest(validateMoodRecord),
  createMoodHandler
);
```

**约束清单**：
- 认证中间件 `authenticate` 在需要登录的路由上必须使用
- 参数校验使用 express-validator 链式调用
- 路由文件只做注册和中间件绑定，不写业务逻辑

---

## 4. 前端开发约束

### 4.1 API 调用约束

- 所有 API 调用通过 `src/utils/request.ts` 封装的 Axios 实例
- 统一拦截器处理 Token 注入和 401 重定向
- 响应数据校验：`response.data.code === 0` 判断成功
- 类型定义：在 `src/types/` 下定义与后端一致的接口类型

### 4.2 命名约束

| 层级 | 命名风格 | 示例 |
|---|---|---|
| 组件 | PascalCase | `MoodRecordCard.vue` |
| 组合式函数 | camelCase, use 前缀 | `useMoodList.ts` |
| Store | camelCase, use 前缀 | `useAuthStore.ts` |
| API 函数 | camelCase | `recordMood()`, `getMoodList()` |
| 路由路径 | kebab-case | `/mood-record`, `/case-list` |

---

## 5. 代码提交约束

### 5.1 Commit Message 规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <description>

[optional body]
```

| Type | 说明 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变功能） |
| `test` | 测试 |
| `docs` | 文档 |
| `chore` | 构建/工具变更 |
| `perf` | 性能优化 |

### 5.2 提交粒度

- 每个 commit 包含最小逻辑变更（一个功能点 / 一个修复）
- 不允许混合不相关变更
- 提交前必须通过 `npm test` 和 `npm run build`

---

## 6. 技术基线不可改动项

以下技术选型为项目基线，**不允许擅自更换**：

| 技术项 | 基线选型 | 原因 |
|---|---|---|
| 数据库 | MySQL 8.4 | 已部署、数据已存在 |
| 后端架构 | Repository 分层 | 已重构完成、35 测试套件通过 |
| API 返回格式 | `{ code, message, data, requestId }` | 前端已对接、全局统一 |
| 加密方案 | AES-256-GCM | 已实现、密钥已分发 |
| 密码哈希 | bcrypt (cost=12) | 已实现 |
| 认证方案 | JWT (HS256) | 已实现 |
| 容器化 | Docker Compose (MySQL + Redis) | 已部署 |
| 进程管理 | PM2 (单进程) | 2核2G 资源约束 |

---

## 7. 待确认风险清单

> 以下列出所有「PRD 需求」和「现有代码」存在不一致的地方，**需要人工确认后决策**。

### 风险-1：测评提交接口状态不一致

| 项目 | 内容 |
|---|---|
| **PRD 要求** | P0-T2 任务实现测评提交功能，替换旧硬编码评分规则 |
| **代码现状** | `POST /api/questionnaires/assessments` 返回 503（功能未启用） |
| **冲突点** | PRD 已标记 P0-T2 完成，但接口仍为 503 |
| **建议** | 确认 P0-T2 是否已完成开发，若未完成则排入下阶段 |

### 风险-2：assessment_items 字段命名与 PRD 不一致

| 项目 | 内容 |
|---|---|
| **PRD 设计** | 字段名 `instrument_version_id`、`item_code`、`prompt`、`is_reverse` |
| **代码 DDL** | 字段名 `assessment_version_id`、`item_order`、`item_text`、`reverse_scored` |
| **冲突点** | PRD 与 DDL 中有 4 个字段名不一致 |
| **建议** | 以代码 DDL 为准，PRD 需同步更新字段名 |

### 风险-3：assessment_sessions 状态枚举与 PRD 不一致

| 项目 | 内容 |
|---|---|
| **PRD 设计** | 状态枚举 `('draft', 'submitted')` |
| **代码 DDL** | 状态枚举 `('started', 'submitted', 'voided')` |
| **冲突点** | PRD 缺少 `started` 和 `voided` 状态 |
| **建议** | 以代码 DDL 为准，PRD 需同步更新 |

### 风险-4：assessment_answers 字段命名与 PRD 不一致

| 项目 | 内容 |
|---|---|
| **PRD 设计** | 字段名 `answer_value`、`item_score` |
| **代码 DDL** | 字段名 `answer_value_json`、`score` |
| **冲突点** | 2 个字段名不一致 |
| **建议** | 以代码 DDL 为准 |

### 风险-5：已废弃接口仍存在

| 项目 | 内容 |
|---|---|
| **PRD 要求** | 删除 `incident_fix_list` 和 `feedback_close_list` 表 |
| **代码现状** | 表已删除，但 `managementController.ts` 中 `incidentFixHandler` 和 `feedbackHandleHandler` 仍在路由中 |
| **冲突点** | 路由处理函数返回 200 假成功，但无实际功能 |
| **建议** | 确认是否彻底移除这两个路由，或保留为占位 |

### 风险-6：cases 表外键删除策略与业务需求冲突

| 项目 | 内容 |
|---|---|
| **PRD 要求** | 用户删除时应级联清理关联数据 |
| **代码 DDL** | `cases.student_user_id` 外键 `ON DELETE RESTRICT` |
| **冲突点** | 如果用户有 open 状态 case，RESTRICT 会阻止用户删除 |
| **建议** | 确认业务逻辑：是否应改为"先关闭 case 再删除用户"还是"允许强制删除+级联" |

### 风险-7：prompt_templates 表未在 R0 迁移方案中

| 项目 | 内容 |
|---|---|
| **PRD 设计** | prompt_templates 作为 v1.1 功能表，不在 R0 迁移范围 |
| **代码现状** | 迁移文件 `0180_create_prompt_templates.up.sql` 已存在并执行 |
| **冲突点** | 表已提前创建，PRD 计划表未同步 |
| **建议** | 以代码为准，PRD 更新计划表 |

### 风险-8：非核心模块 Controller 使用旧编码模式

| 项目 | 内容 |
|---|---|
| **代码现状** | activityController、courseController、musicController、postController、relaxController、achievementController 直接调用 Model 层（旧模式），未使用 Repository 分层 |
| **冲突点** | 若 P1/P2 重新启用这些模块，需先重构为 Repository 模式 |
| **建议** | 在 P1 计划中明确标注"非核心模块需先重构再启用" |

### 风险-9：分页参数命名不一致

| 项目 | 内容 |
|---|---|
| **代码现状** | 部分接口使用 `page`/`pageSize`（mood、case、admin），部分使用 `page`/`limit`（activity 旧代码） |
| **冲突点** | 分页参数命名不统一 |
| **建议** | 统一为 `page`/`pageSize`，旧代码在重构时修改 |

### 风险-10：响应格式不一致

| 项目 | 内容 |
|---|---|
| **代码现状** | 核心模块使用 `apiSuccess`/`apiFailure`（`{ code, message, data, requestId }`），旧模块使用 `{ code: 0, data }` 或 `{ success: true, data }` |
| **冲突点** | 响应格式有 3 种变体 |
| **建议** | 统一为 `apiSuccess`/`apiFailure` 格式，旧模块重构时修正 |

---

## 8. 后续开发指令

> 后续交给 AI 生成代码时，必须在 Prompt 中引用本文档规范：

```
请基于以下技术设计文档开发代码，严格遵循所有约束：

1. 系统架构：docs/tech-design/01-system-architecture.md
   - 使用 Controller → Service → Repository 分层架构
   - 禁止跨层调用

2. 数据库设计：docs/tech-design/02-database-design.md
   - 所有表结构、字段名、类型以此文档为准
   - 不私自新增/删减字段
   - 变更通过迁移文件执行

3. API 契约：docs/tech-design/03-api-contract.md
   - 所有接口使用 apiSuccess() / apiFailure() 统一响应
   - 时间格式 ISO 8601 UTC
   - 分页参数 page/pageSize
   - 错误码遵循 5 位编码规则

4. 接口清单：docs/tech-design/04-api-inventory.md
   - 已开发接口如实转录，不修改现有路径和参数
   - 待开发接口按正向设计实现

5. 开发约束：docs/tech-design/05-dev-constraints.md
   - 遵循所有 C-01 ~ C-16 约束
   - 技术基线不可改动
   - 待确认风险清单中的项目需人工确认后再动工

请先阅读以上全部文档，确认理解后再开始编码。
```

---

## 文档版本记录

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本，基于代码现状全量生成 | 系统生成 |