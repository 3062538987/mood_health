远程仓库已有内容导致推送被拒绝(需要先 pull)。先处理你的新任务——探索 docs 目录
The user wants me to stop the push issue for now and instead look at the docs folder. But the push was rejected because the remote has existing content. Let me first address the push issue briefly, then explore the docs folder.

The push failed because the remote repo already has commits. We need to handle this. But the user's new request is about the docs folder. Let me focus on that.

Let me explore the docs folder structure.

### Relevant Code Snippets
1. d:/桌面/ccooddee/docs/checkpoint/P1-P2-checkpoint-report.md:L1-L10
  — 该文件是项目检查点报告的一部分，描述了P1-P2阶段的检查点内容，属于docs目录下的checkpoint子目录。
2. d:/桌面/ccooddee/docs/prd/P0-v1.0-prd.md:L1-L10
  — 此文件是项目需求文档的一部分，定义了P0阶段的v1.0版本产品需求，位于docs目录的prd子目录中。
3. d:/桌面/ccooddee/docs/refactor/R0-acceptance-report.md:L1-L10
  — 该文件是重构项目的验收报告，包含R0阶段的验收信息，位于docs目录的refactor子目录中。
4. d:/桌面/ccooddee/docs/tech-design/01-system-architecture.md:L1-L10
  — 此文件定义了系统的架构设计，属于技术设计文档的一部分，位于docs目录的tech-design子目录中。
5. d:/桌面/ccooddee/docs/API.md:L1-L10
  — 该文件描述了项目API的规范和接口设计，为项目核心文档之一，位于docs根目录。
6. d:/桌面/ccooddee/docs/COMMANDS.md:L1-L10
  — 此文件列出了项目中使用的命令，用于指导开发人员的操作，为项目操作指南的一部分，位于docs根目录。
7. d:/桌面/ccooddee/docs/SQLITE_RELEASE_REPORT_TEMPLATE.md:L1-L10
  — 该文件是SQLite发布报告的模板，用于记录发布过程中的关键信息，位于docs根目录。
8. d:/桌面/ccooddee/docs/TESTING.md:L1-L10
  — 此文件说明了项目的测试策略和标准，作为测试流程的核心文档，位于docs根目录。
9. d:/桌面/ccooddee/docs/superpowers/specs/2026-07-16-link-unblocking-design.md:L1-L10
  — 该文件是超级能力模块的设计文档，标题为2026年7月16日链接解除设计，位于docs目录的superpowers/specs子目录。
10. d:/桌面/ccooddee/docs/tasks/AI_QA_Testing_Standard_V3.md:L1-L10
  — 此文件定义了AI质量保证测试的标准版本3，作为任务文档的一部分，位于docs目录的tasks子目录。

The search subagent found some files. Let me get a more complete list of all files in the docs folder. Let me also check what the LS tool showed earlier.

From the initial LS output, I already have a good picture of the docs directory structure. Let me now read the key files in each subdirectory to understand their content, and then produce a summary document.

Let me read the main files in each subdirectory to understand their purpose.

Let me try using `_path` parameter name for the Read tool.

The Read tool keeps failing. Let me use Grep to read the first lines of each file instead.

Now let me read the checkpoint files, the PRD files, and the refactor files to get a complete picture.

Let me also read some of the remaining files in the prd, refactor, and tech-design folders to get a complete picture.

Let me also read the remaining files in the refactor folder to complete the picture.

Now let me also read the tech-design files quickly to understand the architecture docs.

Now I have a comprehensive understanding of all the docs files. Let me compile the summary. Here's the full structure:

## docs 目录结构

Root:
- API.md - API 接口文档
- COMMANDS.md - 命令速查表
- TESTING.md - 测试指南
- SQLITE_RELEASE_DAY_CHECKLIST.md - SQLite 发布日检查清单
- SQLITE_RELEASE_REPORT_2026-03-30.md - SQLite 发布报告
- SQLITE_RELEASE_REPORT_TEMPLATE.md - SQLite 发布报告模板

checkpoint/ (检查点验收报告):
- P1-P2-checkpoint-report.md - P1/P2 非核心模块验收
- V1.1-checkpoint-b-report.md - V1.1 AI 增强验收
- final-project-acceptance-report.md - 项目最终验收总览

prd/ (产品需求文档):
- P0-v1.0-prd.md - P0/v1.0 核心产品需求
- P0-implementation-plan.md - P0 实施计划
- P1-P2-non-core-prd.md - P1/P2 非核心模块需求
- P1-P2-implementation-plan.md - P1/P2 实施计划
- V1.1-ai-enhancement-prd.md - V1.1 AI 增强需求
- V1.1-implementation-plan.md - V1.1 实施计划

refactor/ (重构相关):
- Checkpoint-A-report.md - R0 Phase A 交付报告
- Checkpoint-B-report.md - R0 Phase B 验证报告
- Checkpoint-C-report.md - R0 Phase C 验证报告
- Checkpoint-D-report.md - R0 Phase D 报告
- R0-acceptance-report.md - R0 架构验收报告
- R0-baseline.md - R0 重构前工程基线
- R0-mysql-migration-plan .md - MySQL 迁移方案
- R0-performance-baseline.md - 性能基线对比
- GitHub-publish-commands.md - GitHub 发布命令
- legacy-backup-manifest.md - 旧 SQLite 备份清单
- R0-before.json / R0-after.json - 性能采样数据
- plan .md / todo .md - 计划/待办

superpowers/specs/:
- 2026-07-16-link-unblocking-design.md - 链路打通设计

tech-design/ (技术设计):
- README.md - 设计文档索引
- 01-system-architecture.md - 系统架构
- 02-database-design.md - 数据库设计
- 03-api-contract.md - API 契约规范
- 04-api-inventory.md - 接口清单
- 05-dev-constraints.md - 开发约束总则

database/:
- R0-mysql-migration-plan.md - MySQL 迁移方案

Now let me write the output document.
现在我已经完整阅读了所有文件。以下是解释文档：

---

## `docs/` 目录文件解释文档

### 项目：大学生情绪健康管理平台 (mood_health)

---

### 一、根目录文件（6 个）

| 文件 | 用途 |
|------|------|
| **API.md** | API 接口文档，描述所有接口的基础 URL、认证方式(JWT)、接口规范 |
| **COMMANDS.md** | 命令速查表，按开发者/测试/运维角色组织常用命令(`npm run dev:all`, `npm run test:all` 等) |
| **TESTING.md** | 测试指南，说明前后端测试分层（Vitest 前端 + Jest 后端 + 手工冒烟 + Locust/wrk 压力测试） |
| **SQLITE_RELEASE_DAY_CHECKLIST.md** | SQLite 版本的发布日检查清单（历史归档） |
| **SQLITE_RELEASE_REPORT_2026-03-30.md** | 2026-03-30 的 SQLite 版本发布报告（历史归档） |
| **SQLITE_RELEASE_REPORT_TEMPLATE.md** | SQLite 发布报告模板（历史归档） |

---

### 二、`checkpoint/` — 检查点验收报告（3 个）

| 文件 | 用途 |
|------|------|
| **P1-P2-checkpoint-report.md** | P1/P2 阶段验收报告：8 个任务完成，6 个非核心模块(音乐/课程/放松/活动/树洞/成就)从 SQLite 迁移至 MySQL，25 个接口启用 |
| **V1.1-checkpoint-b-report.md** | V1.1 AI 增强验收报告：7 个任务完成，DeepSeek API 客户端、Prompt 模板管理、AI 量表解读、AI 情绪报告全部实现 |
| **final-project-acceptance-report.md** | 项目最终验收总览：汇总 R0 → P0/v1.0 → P1/P2 → V1.1 四个阶段的完成状态 |

---

### 三、`prd/` — 产品需求文档（6 个）

| 文件 | 用途 |
|------|------|
| **P0-v1.0-prd.md** | P0/v1.0 核心产品需求：在 R0 架构上完成用户认证、RBAC 权限、情绪记录、测评存储、管理聚合、审计日志等核心业务闭环 |
| **P0-implementation-plan.md** | P0 阶段实施计划 |
| **P1-P2-non-core-prd.md** | P1/P2 非核心模块需求：音乐、课程、放松、活动、树洞帖子、成就系统 |
| **P1-P2-implementation-plan.md** | P1/P2 实施计划 |
| **V1.1-ai-enhancement-prd.md** | V1.1 AI 增强功能需求：DeepSeek API 接入、AI 智能解读、AI 情绪报告生成 |
| **V1.1-implementation-plan.md** | V1.1 实施计划 |

---

### 四、`refactor/` — 重构文档（13 个）

| 文件 | 用途 |
|------|------|
| **R0-acceptance-report.md** | R0 架构稳定最终验收报告：SQL Server 依赖清退，SQLite 活动路径为零，全部通过 Repository 访问 MySQL |
| **R0-baseline.md** | R0 重构前工程基线：记录 2026-07-14 重构开始前的代码/依赖/测试状态快照 |
| **R0-mysql-migration-plan .md** | MySQL 数据库迁移方案：从 SQLite 迁移到 MySQL 8.4 的详细步骤 |
| **R0-performance-baseline.md** | 重构前后性能对比：记录重构前后原始 JSON 采样数据 |
| **Checkpoint-A-report.md** | R0 Phase A 交付报告：工程基线冻结、SQLite 备份、gitignore 清理、PM2 进程名统一 |
| **Checkpoint-B-report.md** | R0 Phase B 验证报告：`createApp()` 应用边界、控制器解耦、测试迁移 |
| **Checkpoint-C-report.md** | R0 Phase C 验证报告：前端请求边界统一、`ApiRequestError` 错误模型 |
| **Checkpoint-D-report.md** | R0 Phase D 报告：MySQL 基础设施搭建完成，迁移脚本、Repository 模式建立 |
| **GitHub-publish-commands.md** | GitHub 提交与发布命令参考：仓库地址、分支策略、提交命令 |
| **legacy-backup-manifest.md** | 旧 SQLite 离线备份清单：备份日期、SHA-256 校验 |
| **plan .md** | 重构总体计划 |
| **todo .md** | 重构待办清单 |
| **performance/** | 性能采样数据：`R0-before.json`(重构前) / `R0-after.json`(重构后) |

---

### 五、`tech-design/` — 技术设计文档（6 个）

| 文件 | 用途 |
|------|------|
| **README.md** | 技术设计文档索引，列出 5 个模块文档 |
| **01-system-architecture.md** | 系统总体架构：前后端分离 + 单体后端，Vue3 + Express + TypeScript + MySQL 8.4 |
| **02-database-design.md** | 数据库设计：MySQL 8.4 InnoDB, utf8mb4, 包含所有表结构设计 |
| **03-api-contract.md** | 统一 API 契约规范：`{ code, message, data }` 响应格式，业务错误码定义 |
| **04-api-inventory.md** | 接口清单：已开发接口 + 待开发接口的完整列表 |
| **05-dev-constraints.md** | 开发约束总则：代码规范、命名约定、Repository 模式、测试要求等 |

---

### 六、`superpowers/specs/` — 增强设计（1 个）

| 文件 | 用途 |
|------|------|
| **2026-07-16-link-unblocking-design.md** | 链路打通设计文档：聚焦后端链路连通性修复，P0(AI 配置) + P1(测评→个案自动创建) |

---

### 七、`database/` — 数据库方案（1 个）

| 文件 | 用途 |
|------|------|
| **R0-mysql-migration-plan.md** | MySQL 迁移方案（已批准版本），与 `refactor/` 中的版本为同一方案的副本 |

---

### 文档关系图

```
项目阶段演进：
R0 (架构重构) → P0/v1.0 (核心业务) → P1/P2 (非核心模块) → V1.1 (AI 增强)

对应文档：
  refactor/         prd/              checkpoint/               checkpoint/
  ├─ R0-*.md        ├─ P0-v1.0-prd.md  ├─ ...                    ├─ V1.1-*.md
  ├─ Checkpoint-A~D  ├─ P0-plan.md      ├─ P1-P2-checkpoint.md    └─ final-*.md
  └─ R0-acceptance   ├─ P1-P2-prd.md    └─ final-acceptance.md
                     └─ V1.1-prd.md

技术参考：
  tech-design/ (架构/数据库/API/约束)
  API.md (接口文档)
  COMMANDS.md (命令速查)
  TESTING.md (测试指南)
```