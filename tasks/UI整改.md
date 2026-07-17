# 代码与 UI 全量评审整改执行计划

> 建议文件名：`技术改造计划_代码与UI全量评审任务拆分.md`  
> 需求来源：`评审报告_代码与UI全量评审.md`  
> 执行方式：严格串行、小任务验证成功后立即提交，不等待用户审核。

## 一、执行原则

- 从已完成 R0 的最新提交创建独立分支 `codex/full-review-remediation`，不直接使用含未提交修改的现有工作树。
- 严格按照“先写或补充回归测试 → 确认测试失败 → 修改 → 重复验证 → 自检差异 → 提交”的闭环执行。
- 一个提交只解决一个逻辑目标；接口、页面、测试基建和全局主题不得混入同一提交。
- 验证失败时不提交、不跳过、不切换任务，继续修复当前任务直至通过。
- 每个任务成功后立即本地提交 Git；不自动推送、不创建 PR。
- 已经满足要求的报告项不制造空提交，以测试证据关闭，并记录到最终整改报告。
- 不设置用户审核节点。阶段检查由执行代理完成浏览器、接口、日志和代码自审。
- 报告中的 P0/P1/P2 表示缺陷严重度，不等同于项目版本阶段。
- 保持冻结边界：不启用未审核量表、不编写 SDS/SAS 等自创计分、不提前接入 AI、不重新开放被停用的非核心模块。

## 二、固定接口与技术决策

### API 契约

- 所有响应继续使用 `{ code, message, data }`，成功业务码为 `0`。
- 参数校验失败返回 HTTP 400、业务码 `1001`，`data.errors` 仅包含 `{ field, message, location }`，不得回传密码等原始输入值。
- 新增 `DELETE /api/auth/me`：
  - 需要有效 Bearer Token。
  - 成功后立即删除当前账号及依赖外键级联的数据。
  - 返回 `{ code: 0, message: "账号已注销", data: null }`。
  - 前端只能在接口成功后清除登录状态；失败时保留会话和确认弹窗。
- 新增前端 `deleteMoodRecord(id: number): Promise<null>`，请求 `DELETE /api/moods/:id`。
- 问卷提交契约保持 `answers: number[]`。报告建议改为对象数组与最新代码不符，禁止照抄。
- 量表未完成选型审核前，提交继续返回 `503 + FEATURE_DISABLED`，不得恢复旧 SDS/SAS 计分。
- 401 登录跳转使用路由对象携带 `query.redirect`；登录页只接受以单个 `/` 开头的站内路径，拒绝 `//` 和外部 URL。

### UI 标准

- 所有交互元素支持键盘操作和清晰的 `:focus-visible`。
- 正文对比度不低于 4.5:1，大字号和控件边界不低于 3:1。
- 加载、空数据、错误、提交中、提交失败状态均有可读文本，错误区域使用 `role="alert"` 或 `aria-live`。
- 响应式验证固定覆盖 320、768、1024、1440 像素。
- 统一使用现有蓝绿色主题，并补充语义化 danger、focus、surface、muted 等变量；不再保留各模块独立紫色渐变。
- 心理答题内容不写入 `localStorage`。提交失败只在当前会话内保留答案，避免敏感数据长期存储。

## 三、逐任务执行清单

### 阶段 A：执行与测试基建

#### A-01：建立干净执行工作树

- 从最新已批准的 R0 提交创建新分支和独立工作树。
- 确认不带入现有 `scripts/doctor.mjs`、`scripts/pm2-contract.test.mjs` 等未提交修改。
- 记录基线：前端 64 项测试、后端 142 项测试、`build:all` 当前通过。
- 本任务只做环境准备，不产生提交。

#### A-02：增加非写入式质量命令

- 增加 `lint:check`、`typecheck:all`，保留现有会自动修复的 `lint` 命令但不将其作为验收命令。
- 验证 lint 不改写文件，前后端 TypeScript 检查通过。
- 提交：`chore(qa): add non-mutating quality gates`

#### A-03：建立真实服务 Playwright 基建

- 增加 Playwright 配置、`test:e2e` 脚本和真实 MySQL E2E 数据库生命周期脚本。
- E2E 数据库必须使用固定安全后缀 `_e2e`，执行前重建、Migration、Demo Seed，禁止连接开发或生产库。
- Playwright 启动真实前端和后端；E2E 禁止 Mock API。
- 首个冒烟覆盖注册、登录、首页、退出，并检查 Console、Network 和后端异常日志。
- 提交：`test(e2e): add isolated real-stack browser harness`

### 阶段 B：报告 P0 缺陷

#### B-01（P0-3）：统一参数校验失败契约

- 修改校验中间件，使用 `apiFailure(1001, firstMessage, { errors })`。
- 补充无效注册、无效登录和非法问卷参数测试，确认响应始终包含 `data`，且不泄露密码值。
- 提交：`fix(api): normalize validation error responses`

#### B-02（P0-2）：锁定问卷真实契约与安全边界

- 运行现有前端问卷 API 测试和后端 questionnaire controller 测试。
- 确认 `answers: number[]`、页面单次解包及 `FEATURE_DISABLED` 均成立。
- 不改成 `{ itemId, score }[]`，不启用计分。
- 当前代码和测试已满足时，以验证证据关闭，不产生空提交。

#### B-03（P0-5）：补齐情绪类型与标签错误契约

- 保留最新 R0 已完成的 `apiSuccess/apiFailure` 实现。
- 增加服务异常、非法标签名测试，验证成功和失败均返回完整响应包。
- 提交：`test(api): cover mood support-data error contracts`

#### B-04（P0-1）：接通情绪档案真实删除链路

- 增加前端删除 API，并在用户确认后先请求后端；成功后再移除本地记录并更新总数。
- 失败时列表和总数保持不变，显示错误提示；取消确认不发请求。
- 单元测试覆盖成功、失败、取消；真实 E2E 覆盖“新建记录 → 删除 → 刷新后仍不存在”。
- 提交：`fix(mood): persist archive record deletion`

#### B-05（P0-4）：实现后端当前账号注销

- 在用户 Repository、认证 Service、Controller 和认证路由增加当前账号删除能力。
- 覆盖未登录 401、成功删除、账号不存在、外键级联和删除后旧 Token 无法继续访问。
- 使用隔离 MySQL 验证用户及核心个人数据确实被删除。
- 提交：`feat(auth): add authenticated account deletion`

#### B-06（P0-4）：接入设置页注销流程

- 增加前端注销 API；确认按钮加入提交中状态并阻止重复点击。
- 成功后关闭弹窗、清除 Store/Token、提示“账号已注销”并跳转登录页。
- 删除虚假的“7 个工作日后永久删除”文案；失败时不清理本地登录状态。
- E2E 使用临时注册账号验证完整链路。
- 提交：`fix(settings): connect account deletion flow`

#### B-07（P0-6）：补齐 MoodLayout TypeScript 类型

- 改为 `<script setup lang="ts">`，直接使用已有路由 `subNav` 类型，不使用 `any`。
- 验证无类型错误、子导航过滤逻辑不变。
- 提交：`fix(mood): type mood layout navigation`

### Checkpoint B

运行完整 P0 门禁：

```text
npm run lint:check
npm run typecheck:all
npm run test:run
npm --prefix mood_health_server run test:stable
npm run build:all
npm run test:e2e
```

同时检查情绪删除和账号注销的数据库结果、Network、Console、后端日志。

### 阶段 C：报告 P1 交互缺陷

#### C-01（P1-1）：问卷列表加载、错误和空状态

- 使用一个页面级加载流程并发获取列表和历史记录。
- 列表请求失败显示阻断错误与重试；历史请求失败仅显示非阻断提示，仍允许浏览列表。
- 加载使用 `SoftLoadingState`；空数据使用 `SoftEmptyState`；状态具备 ARIA 文本。
- 提交：`fix(questionnaire): add list loading and recovery states`

#### C-02（P1-2）：问卷提交失败保留作答

- 增加 `isSubmitting` 和页面内提交错误状态，阻止重复提交。
- 失败后停留在最后一题，所有答案和当前位置保持不变，可直接重试。
- 不将心理答题写入 `localStorage`。
- 在真实后端返回 `FEATURE_DISABLED` 时验证答案仍保留。
- 提交：`fix(questionnaire): preserve answers after submit failure`

#### C-03（P1-3）：注册页只显示一个有效错误

- Store 增加 `clearError()`；新一次注册和字段修改时清除过期服务错误。
- 页面只保留统一错误出口，字段错误优先于服务端错误。
- 提交：`fix(auth): unify registration error feedback`

#### C-04（P1-4）：登录成功反馈

- 登录成功显示一次轻量成功提示，再进入目标页面。
- loading 期间按钮禁用，防止重复登录请求。
- 提交：`fix(auth): confirm successful login`

#### C-05（P1-5）：收紧情绪记录提交条件

- `canSubmit` 同时要求未在提交、至少选择一种情绪、强度值有效。
- 禁用按钮需要可感知样式；提交函数仍保留同等校验，避免仅依赖 UI。
- 提交：`fix(mood): enforce record form prerequisites`

#### C-06（P1-6）：设置保存反馈与异常处理

- 设置和通知写入成功分别给出轻量提示。
- 捕获 `localStorage` 写入异常，失败时恢复原值并提示未保存。
- 避免同一次操作重复弹出多个提示。
- 提交：`fix(settings): report preference save results`

#### C-07（P1-7）：咨询输入区持久失败提示

- 输入框下方增加 `role="alert"` 错误横幅，说明发送失败且原文字已保留。
- 新一次发送开始时清除旧错误；再次失败更新错误；成功后清除。
- 保留消息级失败标记和重试能力。
- 提交：`fix(counseling): clarify message send failures`

### 阶段 D：报告 P2 UI 与可访问性

#### D-01（P2-1）：登录与注册字段级实时校验

- 在 blur 后显示用户名、密码、确认密码、邮箱的字段错误。
- 输入修正后即时清除对应错误；使用 `aria-invalid`、`aria-describedby`。
- 提交时复用同一组校验函数，避免 blur 与 submit 规则漂移。
- 提交：`feat(auth): add accessible field validation`

#### D-02（P2-2）：问卷选项键盘操作

- 将选项改为原生 radio group，保留按钮式视觉表现。
- 支持 Tab 进入、方向键切换、Space 选择和明显焦点环。
- 使用 `fieldset/legend` 表达题目与选项关系。
- 提交：`fix(questionnaire): make answer options keyboard accessible`

#### D-03（P2-3）：锁定未登录不请求情绪数据

- 增加 App 回归测试：无 Token、过期 Token、身份恢复失败均不得调用情绪列表接口。
- 已有逻辑满足时只提交回归测试，不改业务代码。
- 提交：`test(app): prevent mood fetch without valid session`

#### D-04（P2-4）：完善移动端五入口导航

- 移动端固定为“首页、情绪、提升、咨询、更多”五项。
- “更多”弹层包含“我的”，管理员额外包含“管理后台”，避免超过五个底栏入口。
- 支持键盘、Escape、点击外部关闭、焦点回归和安全区。
- 提交：`feat(navigation): expand accessible mobile navigation`

#### D-05（P2-7）：建立全局语义色彩变量

- 在主题文件补充 primary、primary-hover、surface、danger、focus、muted 等语义变量。
- App 动态情绪色改为引用主题变量，不再返回散落的原始色值。
- 提交：`style(theme): define semantic color system`

#### D-06（P2-5）：提高删除按钮辨识度

- 删除按钮使用 danger 语义色、可见边框和明确 hover/focus 状态。
- 危险含义同时通过文字或图标表达，不只依赖红色。
- 验证对比度和键盘焦点。
- 提交：`fix(mood): strengthen archive delete affordance`

#### D-07（P2-6）：首页新用户引导

- 已登录、情绪数据加载完成且为空时显示引导卡。
- 主行动仅为“记录第一条情绪”；未审核量表不作为强制引导。
- 加载中和请求失败不得误显示新用户状态。
- 提交：`feat(home): add first-record onboarding`

#### D-08（P2-7）：迁移登录和注册主题

- 移除紫蓝渐变与硬编码紫色，使用全局蓝绿色主题、统一表单边界和焦点样式。
- 保持认证页面信息层级清晰，不增加通用大卡片或过度阴影。
- 提交：`style(auth): align pages with global theme`

#### D-09（P2-7）：迁移情绪记录主题

- 将情绪记录页的模块主色、按钮、焦点和边框替换为语义变量。
- 情绪本身的分类颜色可以保留，但不得作为唯一状态信息。
- 提交：`style(mood): align record page with semantic colors`

#### D-10（P2-7）：迁移咨询页面主题

- 移除独立紫色主色，统一使用全局主题和 surface 层级。
- 保留用户消息与系统消息的内容区分，但保证对比度和错误状态清晰。
- 提交：`style(counseling): align chat with global theme`

#### D-11（P2-8）：401 跳转保留当前站内路径

- 请求层在非登录页遇到 401 时跳转 `{ path: "/login", query: { redirect: fullPath } }`。
- 同一批 401 只触发一次跳转和一次提示，防止并发请求重复导航。
- 提交：`fix(auth): retain destination after session expiry`

#### D-12（P2-8）：登录后安全返回原页面

- 登录页读取并校验 `redirect`；合法站内路径成功返回，非法或缺失时回首页。
- 覆盖编码查询参数、嵌套路由、外部 URL 和 `//host` 拒绝场景。
- 提交：`fix(auth): restore safe post-login redirect`

#### D-13（P2-9）：问卷移动端操作栏

- 320–768 像素下使用 sticky 底部操作栏和 `safe-area-inset-bottom`。
- 页面内容增加等量底部空间，按钮不能遮挡选项或错误提示。
- 桌面布局保持普通文档流。
- 提交：`style(questionnaire): keep mobile actions reachable`

#### D-14（P2-10）：缩短情绪备注提示文案

- placeholder 改为“从一件小事开始：今天什么时候开始觉得不舒服？”。
- 320 像素检查不遮挡、不异常截断。
- 提交：`copy(mood): shorten record note guidance`

### 阶段 E：最终验收与证据

#### E-01：全报告逐项关闭

- 对 23 个报告编号建立“已修复 / 已由现有实现满足 / 已按冻结边界关闭”的映射。
- 生成仓库内整改报告，记录每个提交哈希、测试命令、测试数量、E2E 截图或日志位置及剩余风险。
- 重新执行完整质量门禁，并检查：
  - 真实注册、登录、情绪新增和删除、账号注销。
  - Token 过期后重新登录返回原页面。
  - 问卷提交禁用时答案不丢失。
  - 键盘、焦点、四档响应式和颜色对比度。
  - Console 无 Error、Network 无意外 4xx/5xx、后端无未处理异常。
- 最终文档提交：`docs(qa): record full review remediation evidence`

## 四、每个任务的固定提交门禁

每个有代码改动的任务必须依次执行：

1. 写回归测试并确认能复现原问题。
2. 实现最小修复。
3. 运行该任务的定向 Vitest/Jest/Playwright。
4. 运行相关 TypeScript 检查和 `lint:check`。
5. 执行 `git diff --check`，确认没有无关格式化、生成物或其他工作树内容。
6. 自审安全、错误状态、响应式、可访问性和冻结边界。
7. 验证通过后立即提交。
8. 每完成 3 个任务，再运行一次前后端完整测试与 `build:all`。

任何门禁失败均回到当前任务继续修改，禁止带失败状态提交。

## 五、假设与默认值

- 执行基线采用最新已批准的 R0 Phase D 提交，不以当前较旧的 Phase A 主工作树为基础。
- 2026-07-16 最新 R0 工作树的基线为：前端 9 个测试文件、64 项测试通过；后端 33 个测试套件、142 项测试通过；前后端构建通过。
- P0-2 的对象数组建议认定为过期结论；当前 `number[] + FEATURE_DISABLED` 才是批准契约。
- P0-5 的主体修复已存在，剩余工作是补齐失败分支的回归覆盖。
- 本轮允许修复现有功能和 UI，不允许启用未审核量表、恢复自创计分或接入 v1.1 AI。
- Playwright E2E 使用真实服务和隔离 MySQL，不使用 Mock；组件单元测试可以 Mock 网络以稳定覆盖 UI 状态。
- 不创建空提交，不覆盖其他工作树修改，不推送远端，不创建 PR，也不暂停等待用户审核。
