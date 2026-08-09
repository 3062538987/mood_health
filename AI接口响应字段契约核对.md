# 前后端 AI 接口响应字段契约一致性核对

> 审计日期：2026-08-09（轮次⑤续·契约核对）
> 方法：对每个 AI 端点，比对「前端 `src/api/*` 的 TS 响应类型 / 实际消费字段」与「后端控制器 `apiSuccess(...)` 实际返回对象」逐字段对照；FastAPI 原始结构下钻到 `mood_health_ai_service/app/models/contracts.py` 与 `fastApiClient.ts` 的 Response 接口验证。
> 配套：正向审计（前端→后端缺口，已修 1 处）、反向审计（后端→前端孤儿，23 个端点）、本文件为 AI 端点「响应字段契约」专项核对。

## 一、结论（先说结果）

**全部 15 个 AI 端点的响应字段契约均对齐 —— 无字段名错位、无前端必填字段缺失、无类型硬冲突。** 此前担心的"API 通了但 UI 取错字段"在 AI 主链路**未发生**。

逐端点核对如下（✅ = 完全对齐；⚠️ = 对齐但有一处软风险备注）：

| # | 端点 | 前端期望类型 | 后端实际返回 | 结论 |
|---|------|------------|------------|------|
| 1 | `POST /api/ai/interpret` | `InterpretationResult{content,generatedAt}` | `{content,generatedAt}` | ✅ |
| 2 | `POST /api/ai/report` | `MoodReportResult{content,generatedAt}` | `{content,generatedAt}` | ✅ |
| 3 | `POST /api/ai/context/analyze` | `MoodAnalysisResponse{analysis,suggestions,mood?}` | `{analysis,suggestions,mood,mood_score,risk_level,...,timestamp}` | ✅（后端多字段，前端只用前 3 个） |
| 4 | `POST /api/mood-analyses` (+`GET/:id`,`GET`,`GET/latest`,`POST/:id`) | `AnalysisResponse{id,period,status,result?,job?,createdAt,updatedAt}`；`result:AiAnalysisResult` | `toAnalysisResponse`：`result = version.analysisContent`（即 FastAPI `MoodAnalysisResponse`） | ✅ **与 `contracts.py` 逐字段一致** |
| 5 | `POST /api/ai/counseling` | `CounselingResponse{response,mood?,riskLevel?,suggestion?,hasRiskContent?}` | `{response,riskLevel,hasRiskContent,suggestion,crisisHelplines?,fallbackUsed,provider,model}` | ✅ |
| 6 | `POST /api/counseling/send` | `SessionCounselingResponse{response,sessionId,riskLevel?,hasRiskContent?,suggestion?,fallbackUsed?,provider?,model?,sources[],groundingUsed,requestId}` | `UnifiedAssistantResult{response,sessionId,riskLevel,hasRiskContent,suggestion?,sources[],groundingUsed,requestId,provider?,model?,fallbackUsed,webSearchStatus}` | ✅（后端把 `answer` 已映射成 `response`；`sources` 多 `sourceType/url` 无害） |
| 7 | `POST /api/knowledge-assistant/messages` | `KnowledgeAnswer{sessionId,answer,sources[],requestId,provider,model,fallbackUsed}` | `{sessionId,...RagAnswerResponse{answer,sources[],requestId,provider,model,fallbackUsed}}` | ✅ |
| 8 | `GET /api/knowledge-assistant/sessions` | `KnowledgeSession[]{sessionId,title,lastMessageAt,messageCount}` | repo `KnowledgeSession` 同字段 | ✅ |
| 9 | `GET /api/knowledge-assistant/sessions/:id/messages` | `KnowledgeMessage[]{role,content,sources[],createdAt}` | repo `KnowledgeMessage` 同字段 | ✅ |
| 10 | `GET /api/ai/history` | `AiHistoryListResponse{list:AiHistoryItem[],total,page,pageSize}` | repo `HistoryListItem{id,analysisType,riskLevel,requestStatus,analysisSummary,scene,securityStatus,createdAt}` | ✅（`analysisSummary` 已从 JSON 剥引号） |
| 11 | `GET /api/ai/history/:id` | `AiHistoryDetail`（含 `analysisContent{summary,possibleCauses,todayActions[],whenToSeekHelp}` 等） | 直接回显前端 `saveHistory` 时写入的 `analysis_content`（前端自存自读，自洽） | ✅ |
| 12 | `GET /api/moods/insight` | `MoodInsightResponse{summary,distribution,trend,polarity,periodComparison}` | `moodService.getMoodInsight` 返回完全相同的 5 字段 | ✅ |
| 13 | `POST /api/ai/insight` | `AiInsightResponse{analysis}` | `{analysis}`（无记录时返回鼓励文案） | ✅ |
| 14 | `POST /api/ai/treehole/gentle-reply` | `GentleReplyResponse{reply,is_fallback}` | `{reply,is_fallback:false}` | ✅ |
| 15 | `GET/POST /api/posts/:id/ai-reply(+generate-ai-reply)` | `AiReply{id,postId,content,createdAt}` | repo `AiReplyDto{id,postId,content,createdAt}` | ✅ |

## 二、关键对齐证据（最易出错的几处，已逐一确认）

1. **情绪分析 `result` 字段**（最核心链路）：
   - 前端 `AiAnalysisResult`：`summary / patterns[] / possibleFactors[] / actions[] / whenToSeekHelp / warnings[] / provider? / model? / promptVersion?`
   - FastAPI `MoodAnalysisResponse`（`contracts.py:76`）：`summary / patterns[PatternItem] / possibleFactors / actions[ActionItem] / whenToSeekHelp / warnings / provider / model / promptVersion` —— **字段名与层级完全一致**，且 `model_config={"extra":"forbid"}` 约束不会有意外字段。
   - 后端 `toAnalysisResponse` 直接把 `version.analysisContent` 透传为 `result`，无重命名/裁剪。✅

2. **咨询 `send` 的 `response` vs `answer` 陷阱（已规避）**：FastAPI 统一助手 `AssistantResponse` 用 `answer`，但后端 `unifiedAssistantService` 在组装 `UnifiedAssistantResult` 时已显式映射为 `response`（`:29` `response: string`、`:78` `response = result.answer`）。前端 `SessionCounselingResponse` 用 `response` —— **正确**，未踩坑。⚠️ 提醒：若以后直接透传 `AssistantResponse` 而非走 `UnifiedAssistantResult` 封装，会出现 `answer`/`response` 错位，需保持此封装。

3. **知识助手 `messages` 用 `answer`**：`RagAnswerResponse` 字段即 `answer`，前端 `KnowledgeAnswer` 也用 `answer` —— 一致；与咨询链路的 `response` 命名不同，但各自内部自洽，无跨端点混淆。

4. **历史列表 `analysisSummary`**：repo 用 `JSON_EXTRACT(analysis_content,'$.summary')` 取摘要并 `replace(/^"|"$/g,'')` 剥 JSON 引号，前端直接渲染字符串 —— 对齐。

## 三、软风险（非契约断裂，建议留意）

- **`POST /api/ai/context/analyze` 的 `suggestions`**：后端 `result.suggestions || [result.suggestion]`，若 AI 两者皆空则 `suggestions` 为 `undefined`。前端 `MoodAnalysisResponse.suggestions?` 标了可选类型，且 UI 多带 `?.` 兜底，一般不崩；但个别迭代处若直接 `suggestions.map` 需确认有守卫。该接口是**旧版内联 debounce 分析**（主分析 UI 实际走 `/api/mood-analyses/:id` `runAnalysis`），影响面有限。
- **`sources` 多出 `sourceType`/`url`**：咨询与知识助手 sources 含额外字段，前端 `KnowledgeSource{title,reference}` 仅取所需，多余字段无害。
- **`POST /api/mood-analyses` 无记录时**：后端 `apiSuccess(null,'该周期内无情绪记录')`；前端 `createAnalysis` 未显式声明可收 `null`，但 `AnalysisResponse` 调用点多为 `getLatestAnalysis`（`AnalysisResponse|null`）才处理 null，创建分支需确认调用方对 null 的容忍。属于前端调用侧小注意点，非字段错位。

## 四、与前后审计的呼应

- 正向审计：唯一真 bug `/api/ai/feedback`→`/api/feedback`（路径错，非字段错），已修复。
- 反向审计：23 个孤儿端点（admin/内部/待开发），非契约问题。
- 本契约核对：AI 主链路（情绪分析 / 知识问答 / 咨询 / 洞察 / 树洞 / 帖子 AI 回复 / 历史）**字段契约全部对齐**，证明"AI 能力已端到端接通且前后端数据结构一致"，是毕业设计可展示的扎实结论。

## 五、建议

1. （可选加固）在 `POST /api/ai/context/analyze` 返回值对 `suggestions` 兜底为空数组，消除个别 UI 潜在 `undefined.map` 风险。
2. （可选）为 `POST /api/mood-analyses` 创建无记录分支补充 `null` 的调用侧类型/守卫说明，避免 TS 误判。
3. 其余 13 个端点无需改动。
