# AI 功能数据验证提示词

你是一个 Web 应用测试专家。下面是一个 B2B 心理健康平台（面向学校师生）的 AI 功能列表，请帮我生成一份**可直接在浏览器中执行的验证操作手册**，确保我能在网页中逐个验证每个 AI 功能是否正常工作。

---

## 项目背景

- 前端路由页面已部署，后端 API 已启动
- 数据库已有种子数据：3 个角色（学生/咨询师/管理员）、3 个演示用户（demo_student / demo_counselor / demo_super_admin，密码均为 123456）、10 种情绪类型、5 条演示情绪记录
- AI 底层使用 DeepSeek API（需确保 API Key 余额充足）
- 所有 AI 功能均调用真实 API，无假数据兜底

---

## 需要验证的 7 个 AI 功能

### 1. 心理咨询对话 — `/counseling`
- **接口**: `POST /api/ai/counseling`
- **参数**: `{ message: string, context?: Array<{role, content}> }`
- **预期响应**: `{ code: 0, data: { response, riskLevel, hasRiskContent, suggestion? } }`

### 2. 量表解读 — `/improve/questionnaire/result`
- **接口**: `POST /api/ai/interpret`
- **参数**: `{ scaleName, scaleType, totalScore, maxScore, itemScores, riskLevel }`
- **预期响应**: `{ code: 0, data: { content, generatedAt } }`

### 3. 情绪报告生成 — 嵌套在 `/mood/record`
- **接口**: `POST /api/ai/report`
- **参数**: `{ userName, dateRange, recordCount, primaryEmotions, averageIntensity, mostFrequentMood, type, ... }`
- **预期响应**: `{ code: 0, data: { content, generatedAt } }`

### 4. 上下文情绪分析 — `/mood/record`
- **接口**: `POST /api/ai/context/analyze`
- **参数**: `{ message: string, mood: number }`
- **预期响应**: `{ code: 0, data: { analysis, suggestions, mood, mood_score, risk_level, confidence, emotions, fourSection?, dataScope } }`

### 5. 树洞温柔回复 — `/relax/treehole`
- **接口**: `POST /api/ai/treehole/gentle-reply`
- **参数**: `{ content: string }`
- **预期响应**: `{ code: 0, data: { reply, is_fallback } }`

### 6. AI 分析历史 — `/ai-history`
- **接口**: `GET /api/ai/history?page=1&pageSize=20`
- **预期响应**: `{ code: 0, data: { list: [...], total, page, pageSize } }`

### 7. 首页 AI 内容推荐 — `/`
- **接口**: `GET /api/recommend/content?mood=平静&limit=5`
- **预期响应**: `{ code: 0, data: { ...推荐内容 } }`

---

## 请为我生成的内容

请按以下格式输出，每个功能单独一个章节：

### 对于每个 AI 功能，请输出：

1. **操作步骤**（序号化，从打开浏览器输入 URL 开始，到看到结果结束）
2. **需要输入的具体测试数据**（如：在输入框输入什么文字、选择什么选项）
3. **预期看到的结果**（页面应该显示什么内容才算通过）
4. **异常场景验证**（至少 1 个：如输入超长文本、空输入、恶意内容等，预期看到的错误提示）
5. **通过标准**（一句话判定）

---

## 额外要求

- 所有操作步骤必须能在浏览器中直接执行，不需要打开开发者工具或命令行
- 如果有功能需要先登录，请在步骤中明确写出登录用的账号密码
- 如果某个功能需要前置操作（如：先记录情绪才能生成报告），请写清楚前置步骤
- 输出格式为 Markdown，方便我直接复制到笔记中使用
- 语言：中文