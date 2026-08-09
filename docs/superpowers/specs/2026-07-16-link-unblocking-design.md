# 链路打通设计文档

> 状态：设计中
> 日期：2026-07-16
> 版本：v1.0
> 范围：后端链路连通性修复，不含前端/UI

---

## 一、总体概览 & 优先级

本次"链路打通"聚焦后端链路连通性。基于全链路审计结果，按优先级分三档：

| 优先级 | 链路 | 问题 | 改动量 |
|--------|------|------|--------|
| **P0** | AI 配置修复 | `AI_ENABLED=false` + `DEEPSEEK_API_KEY=` 为空 | 2 行 `.env` |
| **P1** | 测评→个案自动创建 | `submitAssessment()` 完成后不自动触发 `autoCreateCase()` | ~30 行代码 |
| **P2** | 死代码清理 + 种子数据 + 其他 | 记录备忘，本次不实现 | — |

**本次实现 P0 + P1。**

---

## 二、全链路审计结果

### 通畅链路

| # | 链路 | 路径 | 状态 |
|---|------|------|------|
| 1 | 认证 | `/api/auth/*` → authService → userRepository → MySQL | 代码完整，测试通过 |
| 2 | 情绪 | `/api/moods/*` → moodService → moodRepository → MySQL | 含加密/周报/趋势/分析 |
| 3 | 测评 | `/api/questionnaires/*` → assessmentService → scoringEngine → MySQL | 计分引擎正常 |
| 4 | 个案 | `/api/cases/*` → caseService → caseRepository → MySQL | CRUD 和手动 auto-create 正常 |
| 5 | 管理 | `/api/admin/*` → managementService → MySQL | 测试通过 |
| 6 | P1/P2 | activities/posts/music/courses/relax/achievements | 路由→控制器→仓库→MySQL 全通 |

### 断裂/问题链路

| # | 链路 | 问题 | 严重度 | 本次处理 |
|---|------|------|--------|----------|
| A | **AI 整条链路** | `AI_ENABLED=false` + `DEEPSEEK_API_KEY=` 为空 | 高 | P0 |
| B | **测评→个案自动创建** | `submitAssessment()` 不自动触发 `autoCreateCase()` | 高 | P1 |
| C | `aiRoutes.ts` 死代码 | 代理转发路由器未在 `app.ts` 中导入 | 低 | P2 |
| D | `counselingService` | 返回硬编码 mock 数据，未接入真实 AI | 中 | P2 |
| E | `moodAnalysisService` | 调用不存在的 Python AI 服务端点 `/analyze-mood` | 中 | P2 |
| F | P1/P2 模块无 seed 数据 | 表存在但数据为空，端点返回空列表 | 低 | P2 |

---

## 三、P0：AI 配置修复

### 3.1 问题

[`.env`](file:///c:/Users/EDY/Desktop/论文/mood_health_server/.env) 中 `AI_ENABLED=false` 且 `DEEPSEEK_API_KEY=` 为空，导致所有 AI 调用在 `isAiAvailable()` 和 `callChatCompletion()` 两个入口被拦截。

### 3.2 改动

**文件**：`mood_health_server/.env`（第 25、28 行）

```diff
- AI_ENABLED=false
+ AI_ENABLED=true

- DEEPSEEK_API_KEY=
+ DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx   # 用户需填入真实 Key
```

### 3.3 链路验证

```
POST /api/ai/interpret
  → aiInterpretationRoutes.ts (mounted at /api/ai)
  → aiInterpretationController.interpretAssessmentHandler
  → aiAssessmentService.generateInterpretation(input)
  → callWithTemplate('PHQ-9 量表解读' | 'GAD-7 量表解读', variables)
  → promptService.getActiveByCategory()  // 从 MySQL prompt_templates 表加载模板
  → 填充 {{scaleName}}, {{totalScore}}, {{maxScore}}, {{itemScores}}, {{riskLevel}}
  → callChatCompletion(messages, {model: 'deepseek-chat', temperature: 0.5, maxTokens: 1024})
  → POST https://api.deepseek.com/v1/chat/completions
  → 返回 AI 解读文本

POST /api/ai/report
  → aiInterpretationController.generateMoodReportHandler
  → aiMoodReportService.generateWeeklyReport(input) | generateMonthlyReport(input)
  → callWithTemplate('周度情绪报告' | '月度情绪报告', variables)
  → callChatCompletion(...)
  → 返回 AI 报告文本 (Markdown 格式)
```

### 3.4 前提条件

- `prompt_templates` 表已通过 migration `0180_create_prompt_templates.up.sql` 创建
- 表中有 6 条 seed 数据（`promptSeed.ts`），包含：
  - `PHQ-9 量表解读` (category: assessment_interpretation)
  - `GAD-7 量表解读` (category: assessment_interpretation)
  - `周度情绪报告` (category: mood_report)
  - `月度情绪报告` (category: mood_report)
  - `AI 心理咨询` (category: counseling)
  - `个性化内容推荐` (category: recommendation)
- 若 seed 未执行，需运行 `npm run seed`

### 3.5 验收标准

```bash
# 1. AI 解读可用
curl -X POST http://localhost:3000/api/ai/interpret \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"scaleName":"PHQ-9","scaleType":"depression","totalScore":12,"maxScore":27,"itemScores":[{"label":"兴趣减退","score":2}],"riskLevel":"moderate"}'

# 预期：返回 { code: 0, data: { content: "...", generatedAt: "..." } }

# 2. AI 报告可用
curl -X POST http://localhost:3000/api/ai/report \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userName":"测试","dateRange":"2026-07-10~2026-07-16","recordCount":7,"primaryEmotions":"开心","averageIntensity":6.5,"mostFrequentMood":"开心","type":"weekly"}'

# 预期：返回 { code: 0, data: { content: "...", generatedAt: "..." } }
```

### 3.6 降级行为

- `AI_ENABLED=false` 时，`/api/ai/interpret` 和 `/api/ai/report` 返回 503 + "AI 服务未启用"
- `DEEPSEEK_API_KEY` 无效时，返回 401 + "AI API Key 无效"
- 模板不存在时，返回 404 + "Prompt 模板 xxx 不存在或未启用"
- DeepSeek API 超时/不可用时，返回 500 + "AI 调用失败"

---

## 四、P1：测评→个案自动创建

### 4.1 问题

当前 `assessmentService.submitAssessment()` 完成计分和会话创建后直接返回结果，**不会自动触发** `caseService.autoCreateCase()`。高风险测评结果需要管理员手动调用 `POST /api/cases/auto-create` 才能生成个案。

### 4.2 方案：Service 层注入（方案 1）

在 `assessmentService` 中注入 `caseService`，计分完成后若 `riskLevel === '高风险'`，自动调用 `autoCreateCase(sessionId)`。

**改动文件**：

| 文件 | 改动 |
|------|------|
| `src/services/assessmentService.ts` | 新增 `CaseService` 依赖注入 + `logger` import，计分后自动创建个案 |

### 4.3 代码改动

#### 4.3.1 `assessmentService.ts`

```typescript
// 新增 import
import { createCaseService, type CaseService } from './caseService'
import logger from '../utils/logger'

// 新增依赖接口
export interface AssessmentServiceDependencies {
  repository?: AssessmentRepository
  caseService?: CaseService  // 新增
}

// 在 submitAssessment 中，创建会话后新增：
export const createAssessmentService = (dependencies: AssessmentServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createAssessmentRepository()
  const caseService = dependencies.caseService ?? createCaseService()  // 新增

  const submitAssessment = async (input: SubmitAssessmentInput) => {
    // ... 现有逻辑：验证量表、计分、创建会话 ...

    const sessionId = await repository.createSubmittedSession(sessionInput)

    // 新增：高风险自动创建个案
    if (scoringResult.riskLevel === '高风险') {
      try {
        await caseService.autoCreateCase(sessionId)
      } catch (error) {
        // 个案创建失败不阻塞测评提交
        logger.error('自动创建个案失败', { sessionId, error })
      }
    }

    return { sessionId, ...scoringResult }
  }
  // ...
}
```

#### 4.3.2 `questionnaireController.ts`

无需改动。`createAssessmentService()` 默认自动创建 `caseService` 实例（`dependencies.caseService ?? createCaseService()`），controller 中现有的 `const assessmentService = createAssessmentService()` 即可正常工作。

### 4.4 链路验证

```
POST /api/questionnaires/assessments
  → questionnaireController.submitAssessment
  → assessmentService.submitAssessment(input)
  → 1. 验证量表存在
  → 2. 获取计分规则
  → 3. scoringEngine.scoreAssessment(answers, rule, stratification, suggestion)
  → 4. repository.createSubmittedSession(sessionInput) → 返回 sessionId
  → 5. if riskLevel === '高风险':
       → caseService.autoCreateCase(sessionId)
         → 获取测评会话详情
         → 检查是否已有未结案个案
         → 无则创建新个案 (status: 'open')
  → 6. 返回 { sessionId, totalScore, riskLevel, riskColor, suggestion }
```

### 4.5 边界情况

| 场景 | 行为 |
|------|------|
| 风险等级不是"高风险" | 不创建个案，正常返回 |
| 高风险但已有未结案个案 | `autoCreateCase` 返回 `{ created: false }`，不重复创建 |
| 测评会话不存在 | `autoCreateCase` 抛出异常，被 catch 吞掉，不阻塞测评提交 |
| 数据库连接失败 | 同上，个案创建失败不影响测评结果返回 |

### 4.6 验收标准

```bash
# 1. 提交一个高风险测评（如 PHQ-9 全部选最高分）
curl -X POST http://localhost:3000/api/questionnaires/assessments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"questionnaire_id":1,"answers":[{"itemId":1,"score":3},{"itemId":2,"score":3},{"itemId":3,"score":3}]}'

# 预期：返回 riskLevel: '高风险'，同时 cases 表中自动生成一条 status='open' 的个案

# 2. 查询个案列表确认
curl http://localhost:3000/api/cases/ \
  -H "Authorization: Bearer <admin_token>"

# 预期：列表中包含刚才自动创建的个案
```

---

## 五、P2（备忘，本次不实现）

### 5.1 `aiRoutes.ts` 死代码清理

- **文件**：`src/routes/aiRoutes.ts`
- **问题**：实现了代理转发到 Python AI 服务的路由器，但 `app.ts` 中未导入
- **处理**：删除或归档，因为当前 AI 链路直接调用 DeepSeek API，不需要中间代理

### 5.2 `counselingService` 接入真实 AI

- **文件**：`src/utils/ai/counselingService.ts`
- **问题**：`simulateAIResponse()` 返回硬编码 mock 数据
- **处理**：改为调用 `callWithTemplate('AI 心理咨询', variables)` → `callChatCompletion()` → DeepSeek API
- **前置**：需要在路由中挂载心理咨询端点

### 5.3 `moodAnalysisService` 修复

- **文件**：`src/utils/ai/moodAnalysisService.ts`
- **问题**：`analyzeMood()` 调用 `aiClient.callByModelType('/analyze-mood', ...)` 指向不存在的 Python AI 服务
- **处理**：改为调用 `callChatCompletion()` 直接访问 DeepSeek API，或使用 prompt 模板

### 5.4 P1/P2 模块 seed 数据

- **问题**：activities/posts/music/courses/relax/achievements 表存在但数据为空
- **处理**：为每个模块编写 seed 脚本，插入演示数据

---

## 六、测试策略

### P0 测试

- 不涉及代码变更，无需新增单元测试
- 手动验收：`curl` 调用 `/api/ai/interpret` 和 `/api/ai/report` 确认返回 AI 生成内容

### P1 测试

- 现有 `assessmentService.test.ts` 需要新增用例：
  - 高风险测评提交后自动创建个案
  - 非高风险测评不触发个案创建
  - 个案创建失败不影响测评提交
- 现有 `caseService.test.ts` 无需改动（`autoCreateCase` 已有测试）

### 回归测试

- 运行 `npm run test:all`，确保 36 suites / 180 tests 全部通过
- 运行 `npm run build:all`，确保构建成功

---

## 七、实施顺序

1. **P0**：修改 `.env` 中的 `AI_ENABLED` 和 `DEEPSEEK_API_KEY`
2. **P0 验收**：重启服务，curl 测试 AI 端点
3. **P1**：修改 `assessmentService.ts` 和 `questionnaireController.ts`
4. **P1 测试**：运行单元测试 + 手动验收
5. **回归**：`npm run test:all` + `npm run build:all`
6. **Git 提交**：P0 和 P1 各一个 commit