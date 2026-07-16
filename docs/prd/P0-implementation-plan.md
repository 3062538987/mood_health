# P0/v1.0 实施计划

## 1. 状态

- 分支：`codex/p0-phase-a`
- 上游：P0/v1.0 PRD 已批准（Checkpoint F 已通过）
- 架构：MySQL 8.4 + Repository 模式 + 统一 API 契约

## 2. 任务清单

### P0-T1：技术测试量表录入

**目标**：在 MySQL 中录入一套完整的技术测试量表（题目 + 计分规则 + 风险分层），替代现有 `TECHNICAL_FIXTURE` 空夹具。

**内容**：
- 更新 `profileSeed.ts` 中 `TECHNICAL_FIXTURE` 为完整量表（5 题，0-4 李克特，累计计分，风险分层）
- 包含 `scoring_rule_json`、`risk_stratification_json`、`suggestion_template_json`
- 包含 5 道题目的 `assessment_items`
- Seed 可重复执行不产生重复数据

**验收**：
- `npm run seed` 退出 0
- MySQL 中 `assessment_instruments`、`assessment_versions`、`assessment_items` 有完整数据
- `npm run test:all` 全部通过

### P0-T2：删除旧硬编码计分规则

**目标**：删除 `questionnaireController.ts` 中写死的 SDS/SAS 计分规则，改为从 `assessment_versions.scoring_rule_json` 读取。

**内容**：
- 删除旧 `questionnaireController.ts` 硬编码规则
- 新增 `scoring-engine.ts` 工具函数，从 JSON 规则计算总分和风险分层
- 更新 `questionnaireController` 相关端点调用新引擎

**验收**：
- `npm run test:all` 全部通过
- 旧 SDS/SAS 硬编码代码零引用

### P0-T3：cases + case_interventions 表 Migration

**目标**：创建风险个案核心表。

**内容**：
- 创建 `0160_create_cases.up.sql` 和 `down.sql`
- 创建 `0170_create_case_interventions.up.sql` 和 `down.sql`
- 包含外键、索引和 CHECK 约束

**验收**：
- `npm run db:migrate` 退出 0
- `npm run db:migrate down` 回滚成功
- `up → down → up` 完整测试通过

### P0-T4：CaseRepository

**目标**：实现个案和干预记录的数据访问层。

**内容**：
- `CaseRepository`：创建、查询（按学生/咨询师/状态）、更新状态、分配
- `CaseInterventionRepository`：创建干预记录、查询个案干预历史

**验收**：
- 新增 `caseRepository.test.ts` 全部通过
- 新增 `caseInterventionRepository.test.ts` 全部通过

### P0-T5：CaseService + CaseController

**目标**：实现个案业务逻辑和 API 端点。

**内容**：
- `CaseService`：创建个案、分配、干预、转介、结案
- `CaseController`：RESTful API 端点
- 权限中间件集成

**验收**：
- 新增 `caseService.test.ts` 全部通过
- 新增 `caseController.test.ts` 全部通过
- API 端点在权限矩阵下正确拦截

### P0-T6：权限扩充 Migration + Seed

**目标**：新增个案相关权限并分配给角色。

**内容**：
- 新增权限编码：`case.read_assigned`、`case.read_own`、`case.create`、`case.assign`、`case.intervene`、`case.refer`、`case.close`、`user.delete`
- 更新 `coreSeed.ts` 中 `ROLE_PERMISSION_CODES`
- 更新 `reference` seed 的角色权限映射

**验收**：
- `npm run seed` 退出 0
- 权限验证测试通过

### P0-T7：数据治理

**目标**：实现账号停用和物理删除。

**内容**：
- `UserService.disableUser()`：停用账号
- `UserService.deleteUser()`：物理删除 + 级联清理 + 审计日志
- 数据保留期限配置

**验收**：
- 停用账号不可登录
- 物理删除级联清理正确
- 所有管理操作有审计日志

### P0-T8：旧表处置

**目标**：删除 SQLite 中的 `incident_fix_list` 和 `feedback_close_list`。

**内容**：
- 从 SQLite 中删除两张旧表
- 删除前端引用

**验收**：
- `rg "incident_fix_list|feedback_close_list"` 零命中

### P0-T9：前端量表 + 风险个案流程

**目标**：前端可完成量表提交、查看结果，以及个案流程。

**内容**：
- 量表答题页面 + 结果展示
- 个案列表 + 详情页（咨询师端）
- 个案分配、干预、转介、结案 UI

**验收**：
- `npm run build:all` 退出 0
- 手动验证核心流程

## 3. 实施顺序

```
P0-T1 量表录入
    ↓
P0-T2 删除旧规则
    ↓
P0-T3 个案表 Migration
    ↓
P0-T4 CaseRepository
    ↓
P0-T5 CaseService + Controller
    ↓
P0-T6 权限扩充
    ↓
P0-T7 数据治理
    ↓
P0-T8 旧表处置
    ↓
P0-T9 前端流程
    ↓
P0 Checkpoint A
```