# 前端代码审查报告

> 审查对象：`D:\桌面\ccooddee`（源码 `src/`，技术栈 Vue3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + ECharts；单测 Vitest，E2E Playwright）
> 审查方式：逐文件阅读关键模块 + 静态扫描 + 实跑（vue-tsc / vitest / playwright list）
> 审查日期：2026-08-08
> 说明：本报告仅做分析，未修改任何源码、未 git commit、未写入 dist/。

---

## 一、概览与评分

| 维度 | 评分(0-10) | 说明 |
|------|-----------|------|
| 代码质量 | 7.0 | script setup 普遍、strict 类型检查通过；但存在 44 处 `any`、多个 1000+ 行巨型 SFC、两处裸 `fetch` 绕过拦截器、错误归一化与 store 消费不一致。 |
| 架构解耦 | 7.0 | api / stores / types / constants / config 分层清晰，无 EventBus 滥用；但 api 层存在重复模块（`activity.ts`/`activityApi.ts`）、类型定义散落 api 内、`SafeResult` 重复定义、部分 store 直接调用 api。 |
| 测试 | 8.0 | 49 个单测文件 / 205 用例全绿，13 个 E2E 覆盖关键流程；但视图/组件覆盖率不均，组件挂载测试有 router-link 未 stub 的告警噪声。 |
| 安全 | 8.0 | Cookie 鉴权（token 不落 localStorage）、`v-html` 仅一处且经 DOMPurify 清洗、环境变量集中读取、源码无硬编码密钥、CSRF 双提交；风险点：两处裸 `fetch` 不带凭证且未解包信封、feature flag 环境变量名不匹配导致开关恒开。 |
| **总评** | **7.5** | 工程基础扎实、质量底线高，主要短板集中在“错误处理一致性”“巨型组件拆分”“少量裸 fetch/重复模块”。属可上线但需治理的稳健项目。 |

实跑结论速览：
- `npx vue-tsc --noEmit` → **EXIT=0，0 类型错误**（strict 模式通过）。
- `npx vitest run` → **49 文件 / 205 用例全部通过**（EXIT=0）。
- `npx playwright test --list` → **13 用例 / 8 文件**列出成功（chromium 已安装）。

---

## 二、源码地图与启动/路由流程

### 2.1 目录职责
- `src/main.ts`：应用入口，挂载顺序 `pinia → router → ElementPlus → #app`。
- `src/App.vue`：全局布局（桌面导航 + 移动端 tab 栏 + 过渡动画 + 页脚 + 成就通知），承载 `userStore`、`moodStore`、`featureFlags` 与退出逻辑。
- `src/router/`：`index.ts` 路由表 + 按 feature flag 动态裁剪；`guards.ts` 登录/角色/权限守卫与引导页重定向。
- `src/stores/`：Pinia，`userStore`（鉴权）、`moodStore`/`moodRecordStore`（情绪）、`relaxStore`（放松）、`achievementStore`（成就）。
- `src/api/`：axios 封装的接口层（约 20 个模块）。
- `src/composables/`：`usePosts`、`useComments` 两个组合式函数。
- `src/utils/`：`request.ts`（axios 实例+拦截器）、`apiBase.ts`、`storageUtil.ts`、`debounce.ts`、`echarts.ts`、`dateUtil.ts`、`validation.ts` 等。
- `src/types/`：集中类型（`api`/`mood`/`user`/`post`/`questionnaire` 等）。
- `src/constants/`：`emotions.ts`、`messages.ts`（空态/错误/成功文案集中化，做得好）。
- `src/config/`：`featureFlags.ts` 功能开关。
- `src/views` 与 `src/components`：视图与组件，按业务域分子目录。
- `src/__tests__/`：Vitest 单测（api / stores / views / components / router / utils / styles）。
- `tests/e2e/`：Playwright E2E。

### 2.2 启动流程
`main.ts` 创建 App → 挂载 pinia/router/ElementPlus。`App.vue` `onMounted` 中若已登录则 `moodStore.fetchMoodList`，并监听文档点击关闭移动端菜单。

### 2.3 路由守卫（`router/guards.ts` + `router/index.ts:449`）
- 每次导航先 `initializeUserState(userStore)`（仅首次 `trySessionRestore` 调 `/api/auth/me` 恢复会话，cookie 鉴权）。
- `shouldRedirectToGuide`：首次进入首页且未完成引导 → 跳 `/guide`（localStorage `guideCompleted` 判定）。
- `getRouteRedirect` 依次判定：`adminOnly`/`roles`（admin|super_admin）→ `guestOnly` → 未登录私有页跳 `/login` → `permission`（基于 `rolePermissions` 角色-权限矩阵）。
- 路由表 meta 上声明 `adminOnly`/`roles`/`permission`/`feature`/`public`/`guestOnly`，`filterRoutes` 按 `featureFlags.nonCoreModules` 裁剪非核心路由与子导航。
- `router.onError` 处理 chunk 加载失败并重载（带 sessionStorage 防重入）。

**评价**：守卫设计完整、角色/权限矩阵集中在 `guards.ts:12`，敏感页均有覆盖，质量较高。

---

## 三、代码质量

### 3.1 Vue SFC 质量
- 普遍采用 `<script setup lang="ts">`，`defineProps` 23 处、`defineEmits` 17 处，整体规范。
- **巨型组件**：`GroupActivity.vue` 1496 行、`MoodArchive.vue` 1344 行、`MoodRecord.vue` 1301 行、`BreathingGuide.vue` 998 行、`Counseling.vue` 981 行、`ActivityDetail.vue` 949 行、`moodRecordStore.ts` 919 行。单文件过长，可维护性风险高，建议按“数据获取 / 表单 / 展示 / 子模块”拆子组件与组合式函数。
- **反模式**：未检出 `v-if` 与 `v-for` 同元素、`dangerouslySetInnerHTML` 等问题。
- **props 类型短板**：`src/components/shared/SubNav.vue:12` 用 `defineProps({ items: { type: Array, default: () => [] } })`，`Array` 无泛型 → `items` 退化为 `any[]`，模板中 `item.path/icon/name` 失去类型保护（见缺陷 #11）。

### 3.2 组合式函数 composables
- `usePosts`/`useComments` 状态与逻辑自包含、返回 ref，基本“纯”（无副作用泄漏），质量良好。
- **响应式陷阱**：未发现解构丢失响应式的典型案例；`moodRecordStore` 正确用 `ref`/`computed` 并保持对 `selectedMoodTypes.value` 的 `.push/.splice` 突变（Vue3 ref 数组可响应）。
- `relaxStore` 将大量计算（本地统计 `calculateLocalStatistics`）放进 store 而非 util，store 偏胖（见 #16）。

### 3.3 TypeScript 类型安全
- `tsconfig.json`：`"strict": true`、`"noEmit": true`、path alias `@/*`。实跑 `vue-tsc` **0 错误**，类型底线过硬。
- **`any` 使用**：全仓共 **44 处** `any`（`grep -E ": any|as any|any\[\]|<any>|any>|, any|Array<any>"` 统计），分布在 26 个文件。典型：
  - `src/stores/relaxStore.ts:67,68,80,93,294`：`clientId as any`、`fallbackRecord as any`、`type as any`。
  - `src/stores/moodRecordStore.ts:299`：`(t as any).id`。
  - `src/api/mood.ts:55,64`：`analyzeMoodWithRetryLegacy(error: any)`。
  - `src/api/post.ts:7,35`：`Record<string, any>`（归一化，可接受但偏宽）。
  - `src/views/improve/CourseDetail.vue:62`：`ref<any>(null)`。
  - 单测文件中若干 `any` 影响较小。

### 3.4 重复代码 / 死代码 / 魔法字符串
- **魔法字符串已较好集中**：API 路径仍散落于各 api 模块（未抽到 `constants` 但属常规），角色名 `'admin'|'super_admin'` 在 `guards.ts` 与 `userStore.isAdmin` 两处定义（见 #19）；状态枚举基本集中在 types。
- **死代码**：
  - `src/views/mood/MoodRecordScript.ts`（539 行）**全仓无任何引用**（仅自身），疑似历史遗留脚本（#7）。
  - `src/stores/moodRecordStore.ts:822-827`：`const recordId = 0; const analysisJob = null;` 后 `if (analysisJob)` 永假，整段 AI 任务提示为死代码（#10）。
  - `userStore.token` 几乎未被请求使用（cookie 鉴权），仅 `Profile.vue:140` 一处判断，属冗余状态（#14）。
- **重复模块**：`src/api/activity.ts` 仅是对 `activityApi.ts` 的薄重导出/重复定义（`getActivityList`/`getActivityDetail`/`joinActivity`/`getMyJoinedActivities` 两套命名并存）（#6）。

### 3.5 错误处理
- 统一拦截器 `src/utils/request.ts`：请求拦截加 CSRF（`x-csrf-token`，非安全方法）、响应拦截 `unwrapResponse` 校验业务 `code`，统一 `ApiRequestError` 并 `ElMessage.error` 提示、401 触发 `handleUnauthorized` 跳登录。设计完整。
- **核心缺陷**：拦截器抛出的 `ApiRequestError` **没有 `.response` 属性**（只有 `status/data/message/code`），但多个 store/api 仍按“原始 AxiosError”读取 `err.response?.data?.message`：
  - `src/stores/moodStore.ts:21-24, 38-41, 55-58`：`errorResponse.response?.data?.message || '通用文案'`，真实后端消息丢失，store 的 `error` 永远为兜底文案。
  - `src/api/mood.ts:65-66`：`shouldRetry` 读 `error.response.status` 永 undefined → 重试逻辑失效。
  - `src/stores/moodRecordStore.ts:613,690,696,709-710`：AI 错误的 `429/5xx` 分支因 `.response` 缺失而失效，仅能走 `requestError.message` 兜底（#1、#2）。
  - 注：`post.ts`/`relax.ts`/`achievements.ts` 的 `toSafeError` 用 `axios.isAxiosError` 判断（对 `ApiRequestError` 为 false）走 `Error` 分支可取 `message`，故这些模块消息正确，但 `status` 仍丢失。

---

## 四、架构与解耦

### 4.1 组件耦合
- 未发现 EventBus/mitt 全局总线滥用（grep 无命中）。
- 跨组件主要通过 `userStore`/`moodStore` 等 Pinia 共享状态，`App.vue` 注入导航，耦合度合理。
- 少数组件直接 `import` 其他组件内部常量（如 `MoodRecord.vue` 复用 store 的 `moodOptions`），可接受。

### 4.2 状态管理
- stores 按领域拆分清晰（user/mood/relax/achievement）。
- **store 直接调用 api**：`moodStore` 调 `getMoodRecordList` 等、`moodRecordStore` 调 `analyzeMoodWithRetry`/`saveMoodAdvice`、`relaxStore` 调 `relaxAPI`。当前规模可接受，但缺“service 层”隔离，store 与 api 边界略糊（#17）。
- **超大 store**：`moodRecordStore.ts` 919 行（含 UI 草稿、AI、提交、推荐规则），`relaxStore.ts` 374 行含本地统计计算，建议下沉到 composables/util。
- 导出风格不统一：`useMoodStore` 为命名导出，`useRelaxStore` 额外 `export default`（#18）。

### 4.3 接口层
- `src/api` 基本按模块独立，请求/响应类型大多复用 `src/types`，但：
  - `relax.ts` 在 api 内**自建** `RelaxRecord`/`RelaxStatistics` 接口，未归入 `src/types`（与其余模块不一致，#8）。
  - `SafeResult` 在 `src/types/api.ts:21`、`src/api/post.ts:5` 各定义一份（relax 复用 types 版），重复（#6）。
  - `activity.ts` 与 `activityApi.ts` 重叠（#6）。
  - api 风格混杂：函数式（`post.ts`/`mood.ts`）与 class（`relax.ts` 的 `RelaxAPI`）并存。

### 4.4 配置 / 环境变量
- `import.meta.env` 仅出现在 `config/featureFlags.ts`、`utils/apiBase.ts`、`router/index.ts`、`moodRecordStore.ts(DEV)`，集中度高，良好。
- **缺陷**：`.env:5` 为 `VITE_FEATURE_NON_CORE_MODULES_ENABLED=true`，但 `featureFlags.ts:24` 读取 `VITE_FEATURE_NON_CORE_MODULES`（且 `.env.example` 用的是后者）。**生产环境该开关的环境变量名不匹配 → 覆盖被静默忽略，永远走默认值 `true`**（#5）。
- 未发现把后端密钥泄露给前端：`AI_API_KEY`/`ENCRYPTION_KEY`/`MYSQL_*` 等仅存在于 `.env`（后端/服务端），前端仅暴露 `VITE_API_BASE_URL`/`VITE_FEATURE_*`，安全（#15）。

---

## 五、测试评估（含实跑结果）

### 5.1 单测（Vitest）
- 文件：`src/__tests__/` 下 **50 个测试文件**（api 14、stores 4、views 17、router 2、utils 3、components 1、styles 9）。
- 配置：`vitest.config.ts` 用 `happy-dom` + `@vue/test-utils`，含 coverage（v8）。
- **实跑**：`npx vitest run --reporter=basic` → **Test Files 49 passed (49)，Tests 205 passed (205)，EXIT=0**。
- 质量抽样：
  - `src/__tests__/api/auth.test.ts`：mock `@/utils/request` 并断言 URL/method，契约测试规范。
  - `src/__tests__/views/mood-record-submit-state.test.ts`：挂载真实组件、stub 重组件、断言禁用态流转，断言充分。**但有 `[Vue warn]: Failed to resolve component: router-link` 告警噪声**（未 stub `router-link`），属测试洁净度问题（#20）。
  - `knowledge-assistant-navigation.test.ts` 有 “No match found for location” 路由告警，测试仍过。
- **覆盖缺口（估算）**：有单测的 views 包括 mood-record、mood-archive、mood-layout、questionnaire*、knowledge-assistant、counseling*、home、login、app-*；**缺单测**的 views/components：relax/*（RelaxCenter/MusicTherapy/TreeHole/Tetris 等游戏组件）、admin/*（仅 E2E 部分触及）、user/Profile、user/Setting、improve/GroupActivity、ActivityDetail、Courses、Knowledge、mood/Insight、mood/analysis（仅 E2E 导航）、achievements、treehole、多数 shared/components。组件级单测尤其薄弱。

### 5.2 E2E（Playwright）
- 文件：`tests/e2e/` 下 **8 个 spec（13 用例）**：`auth`、`counseling`、`mood-record`、`mood-analysis-navigation`、`knowledge-assistant`、`assessment`、`performance`、`fixtures/*`。
- **实跑**：`npx playwright test --list` → 列出 **13 用例**（chromium），EXIT=0（浏览器已安装，列表可执行）。完整 `playwright test` 需后端可达（依赖 `global-setup.ts`/fixtures 起库起服务），未实际跑以免卡死，但列表与配置显示关键流程（登录黄金路径、咨询安全、情绪记录刷新存活、分析页不崩溃、性能 P2-3 包络）均有覆盖，稳定性设计良好。

### 5.3 实跑命令汇总
| 命令 | 成功 | 数量 / 结果 | 典型现象 |
|------|------|------------|----------|
| `npx vue-tsc --noEmit` | 是 (EXIT=0) | 0 类型错误 | strict 通过 |
| `npx vitest run` | 是 (EXIT=0) | 49 文件 / 205 用例全过 | 组件测试有 router-link 未 stub 告警 |
| `npx playwright test --list` | 是 (EXIT=0) | 13 用例 / 8 文件 | chromium 已装，列表成功 |

---

## 六、安全评估（前端视角）

### 6.1 XSS
- 全仓仅 **1 处 `v-html`**（`src/views/improve/CourseDetail.vue:34`），且经 `DOMPurify.sanitize` 清洗（`CourseDetail.vue:65-70`），处理正确。✅
- 其余渲染均走 Vue 文本插值（自动转义）。✅
- 注意：CourseDetail 的文章内容来自接口，虽已清洗，但该接口由裸 `fetch` 获取且未解包信封（见 #3），数据正确性存疑，但 XSS 面已防护。

### 6.2 鉴权
- **Token 存储**：登录返回 `token` 仅存于 `userStore.token`（内存 ref），**不写入 localStorage/sessionStorage**（grep 确认生产代码无 `localStorage.*token`），刷新依赖 `/api/auth/me` + cookie（`withCredentials: true`）恢复会话。无 token 被 XSS 窃取风险。✅
- **路由守卫**：覆盖所有 `adminOnly`/`roles`/`permission`/私有页，含 `meta.public`/`guestOnly` 白名单。✅
- **401 处理**：拦截器统一跳登录并带 `redirect`，`userStore.trySessionRestore` 处理登出重试。✅
- **CSRF**：非安全方法从非 HttpOnly cookie 读取 `csrf_token` 并加 `x-csrf-token` 头（双提交模式）。✅（属标准做法，非高危）
- **风险**：两处裸 `fetch`（`Courses.vue:73`、`CourseDetail.vue:76`）默认 `credentials` 行为取决于同源；若课程接口需登录态，**不带 cookie 会 401**；且绕过了统一错误处理（#3、#4）。

### 6.3 输入校验
- 表单层：`moodRecordStore.submitRecord`（`moodRecordStore.ts:785`）有前端校验（情绪类型、强度 1-10）；`Register.vue`/`Login.vue` 有字段校验（`auth-field-validation.test.ts` 覆盖）。
- 后端校验：接口层对响应做归一化，但前端对部分输入（如树洞/帖子内容长度、HTML）未见集中校验规则；建议关键表单明确“前端+后端”双重校验（项目后端应有，但前端无统一 `validation.ts` 的广泛调用，仅 `utils/validation.ts` 存在）。

### 6.4 密钥
- 源码内无硬编码密钥/后端地址（`AI_API_KEY`/`ENCRYPTION_KEY` 仅在 `.env` 服务端）。✅
- `VITE_` 前缀变量仅 `VITE_API_BASE_URL`/`VITE_FEATURE_*`，无敏感信息。✅

---

## 七、缺陷与风险清单（表格）

| # | 严重度 | file:line | 问题描述 | 建议 |
|---|--------|-----------|----------|------|
| 1 | P1 | `src/stores/moodStore.ts:21-24,38-41,55-58` | store 按 `err.response?.data?.message` 读取错误，但拦截器抛出的 `ApiRequestError` 无 `.response`，真实后端消息被吞，store `error` 永远为兜底文案，错误态失真。 | store 统一读取 `err instanceof ApiRequestError ? err.message : '...'`，或提供 `getErrorMessage(err)`。 |
| 2 | P1 | `src/stores/moodRecordStore.ts:613,690,696,709-710` | `handleAiError` 依赖 `requestError.response?.status/.data` 判定 429/5xx，因 `.response` 缺失，限流/冷却分支失效，仅走 message 兜底。 | 基于 `ApiRequestError.status` 判定；为 AI 限流保留显式分支。 |
| 3 | P1 | `src/views/improve/CourseDetail.vue:34,62,76-78` | 用裸 `fetch` 获取课程并 `course.value = data`（直接把 ApiResponse 信封对象赋给 `ref<any>`），未解包 `data` 字段、未带 `credentials`、绕过拦截器；模板访问 `course.title/coverUrl/content` 全部为 undefined，详情页实际渲染损坏。 | 改用 `@/utils/request`（`request<CourseDetail>` 自动解包信封），或自行解包 `data.data` 并加 `credentials:'include'`。 |
| 4 | P1 | `src/views/improve/Courses.vue:73-78,46` | 同上，`courses.value = data` 直接赋值信封对象；模板 `courses.length === 0` 因对象无 `length` 永远为假，空态不显示且 `v-for` 遍历对象异常。 | 同 #3，改走统一 request 并取 `data.data`。 |
| 5 | P2 | `.env:5` vs `src/config/featureFlags.ts:24` | 生产 `.env` 用 `VITE_FEATURE_NON_CORE_MODULES_ENABLED`，代码读 `VITE_FEATURE_NON_CORE_MODULES`（`.env.example` 也是后者）。环境覆盖名不匹配 → 开关恒为默认 `true`，无法在生产关闭非核心模块。 | 统一变量名为 `VITE_FEATURE_NON_CORE_MODULES`（或改代码读取），并加启动校验。 |
| 6 | P2 | `src/api/activity.ts`、`src/api/activityApi.ts`、`src/api/post.ts:5`、`src/types/api.ts:21` | `activity.ts` 与 `activityApi.ts` 同域重复定义（`getActivityList`/`getActivities` 等并存）；`SafeResult` 在 types 与 post 内各定义一份。 | 合并 activity 模块为单一源；`SafeResult` 仅保留 `types/api.ts` 并全局复用。 |
| 7 | P2 | `src/views/mood/MoodRecordScript.ts`（全文件，539 行） | 文件全仓无任何 import 引用，疑似历史遗留脚本死代码。 | 确认无用后删除；若需保留，补引用与测试。 |
| 8 | P2 | `src/api/relax.ts:8-44` | `RelaxRecord`/`RelaxStatistics` 类型定义在 api 内，未归入 `src/types`，与 mood 等模块“类型集中 types”的约定不一致。 | 迁移到 `src/types/relax.ts` 并在 api 中 `import type`。 |
| 9 | P2 | 26 文件 / 44 处 `any`（如 `relaxStore.ts:67,68,80,93,294`、`moodRecordStore.ts:299`、`mood.ts:55,64`、`CourseDetail.vue:62`） | 类型安全退化为 `any`，逃逸 strict 保护。 | 用具体接口替代 `Record<string, any>`/`as any`；`ref` 标注真实类型。 |
| 10 | P2 | `src/stores/moodRecordStore.ts:822-827` | `const recordId = 0; const analysisJob = null;` 与后续 `if (analysisJob)` 为死代码（7 天分析任务提示永不触发）。 | 删除死代码，或将异步分析任务真正接入后按需启用。 |
| 11 | P2 | `src/components/shared/SubNav.vue:12` | `defineProps({ items: { type: Array } })` 未给泛型，`items` 退化为 `any[]`，`item.path/icon/name` 无类型保护。 | `defineProps<{ items: SubNavItem[] }>()`，或在 object 形式标 `Array as PropType<SubNavItem[]>`。 |
| 12 | P2 | `src/stores/relaxStore.ts:80,93` | 离线兜底把 `{id:'local-...', userId:'anonymous'}` 以 `as any` 推入 `records`（类型 `RelaxRecord[]`），类型不一致，易在模板中访问到 undefined 字段。 | 定义本地草稿联合类型或 `Partial<RelaxRecord>`，避免 `as any`。 |
| 13 | P1 | `src/stores/relaxStore.ts:126,164` | `fetchRecords`/`fetchStatistics` 用 `const userId = 'current-user-id' // 临时值` 占位，且 `if(userId)` 永真 → 离线分支不可达；请求并未真正带用户身份，依赖后端 cookie 隐式过滤，存在“用户数据隔离靠后端、前端无显式 userId”的脆弱性。 | 用 `userStore.user?.id` 显式传入；移除占位常量与误导性 `if(userId)`；补充离线分支单测。 |
| 14 | P2 | `src/stores/userStore.ts:21,76` + `src/views/user/Profile.vue:140` | `token` ref 仅用于内存态与 Profile 一处判断，请求走 cookie 鉴权，`token` 实际是冗余/半死状态。 | 明确 `token` 用途：若仅用于“是否已认证”可删除，统一用 `isLoggedIn`；或复用于请求头（当前未使用）。 |
| 15 | P2 | `src/utils/request.ts:149-167` + `src/views/improve/Courses.vue:73` | 统一拦截器已处理 CSRF/错误/loading，但 `Courses.vue`/`CourseDetail.vue` 裸 `fetch` 绕过全部能力，错误处理/凭证/加载态不一致。 | 统一通过 `@/utils/request` 发请求，避免裸 fetch。 |
| 16 | P2 | `src/stores/relaxStore.ts:197-268` | 本地统计计算 `calculateLocalStatistics`（70+ 行）放在 store 内，store 偏胖、难单测。 | 抽取到 `utils/relaxStats.ts` 纯函数并单测。 |
| 17 | P2 | `src/stores/moodStore.ts:14`、`moodRecordStore.ts`、`relaxStore.ts:56` | store 直接调用 api（无 service 层），store 与接口边界模糊，复用与测试受限。 | 引入 service 层或在 composables 中编排 api，store 仅持状态。 |
| 18 | P2 | `src/stores/relaxStore.ts:374` vs `src/stores/moodStore.ts` | `useRelaxStore` 额外 `export default`，其余 store 仅命名导出，风格不一。 | 统一为命名导出（或统一默认导出）。 |
| 19 | P2 | `src/router/guards.ts:10` + `src/stores/userStore.ts:30` | 角色字面量 `'admin'|'super_admin'` 在两处独立定义，易漂移。 | 将角色枚举/常量集中到 `src/constants/roles.ts` 或 `types/user.ts`。 |
| 20 | P2 | `src/__tests__/views/*.test.ts`（如 `mood-record-submit-state.test.ts` 全局 stubs） | 组件挂载测试未 stub `router-link`/`router-view`，产生大量 `[Vue warn]: Failed to resolve component: router-link` 噪声，掩盖真实告警。 | 在 `vitest.config` 或 `setup.ts` 提供 router 或 stub `router-link`。 |
| 21 | P2 | `src/views/improve/GroupActivity.vue:1496`、`MoodArchive.vue:1344`、`MoodRecord.vue:1301` 等 | 巨型 SFC/store 单文件过长，可维护性、可读性、回归风险高。 | 按“数据获取 / 表单 / 展示 / 子模块”拆分为子组件 + 组合式函数。 |
| 22 | P2 | `src/stores/moodRecordStore.ts:817` | `if (import.meta.env.DEV) console.log('提交情绪记录 payload'...)` 调试日志留在生产构建中。 | 改用 `import.meta.env.DEV && console.debug` 或移除；统一日志工具。 |
| 23 | P1 | `src/api/mood.ts:55,64-76` | `analyzeMoodWithRetryLegacy(error: any)` 与 `shouldRetry` 读 `error.response.status`，但经统一拦截器后已是 `ApiRequestError`（无 `.response`），重试判定失效；且该函数与 `moodAnalysis.ts` 的 `analyzeMoodWithRetry` 功能重复。 | 删除 legacy 重复实现，统一使用 `moodAnalysis.ts` 的版本并基于 `ApiRequestError.status`。 |
| 24 | P2 | `src/stores/moodRecordStore.ts:53-142`（moodOptions 等） | 情绪选项/标签/触发词/推荐规则等大量静态数据内联在 store，使 store 体积膨胀且不利于复用/国际化。 | 抽到 `src/constants/moodOptions.ts` 等常量模块。 |

---

## 八、优先级改进建议（P0/P1/P2）

### P0（本次未发现阻断级，但需立即核实）
- 本次未发现会导致应用无法启动或数据严重泄漏的 P0。上线前建议人工验证两处裸 `fetch`（#3/#4）在登录态下是否真能取到数据——若课程接口需鉴权，则详情页/列表页为**功能性缺陷**，应升为 P0 修复。

### P1（高优先级，建议本迭代修复）
1. **统一错误消费契约（#1/#2/#23）**：store 与 api 内所有 `err.response?.data?.message` 改为读取 `ApiRequestError.message`/`status`；删除 `mood.ts` 的 legacy retry。让真实后端错误可见、AI 限流冷却逻辑生效。
2. **修复裸 fetch（#3/#4/#15）**：`Courses.vue`、`CourseDetail.vue` 改用 `@/utils/request` 并正确解包 `data`，避免详情页/列表渲染损坏与凭证缺失。
3. **relax 用户身份（#13）**：用真实 `userStore.user.id` 替代 `'current-user-id'` 占位，移除永真 `if(userId)`，保证前端显式传递用户上下文并恢复离线分支可达性。

### P2（中优先级，纳入技术债清理）
4. **配置一致性（#5）**：修正 `.env` 的 feature flag 变量名，并补 CI 校验。
5. **接口层去重与归一（#6/#8/#17/#18）**：合并 `activity.ts`/`activityApi.ts`，`SafeResult` 单源，`relax` 类型入 `types`，统一导出风格，store 与 api 间可引入 service 层。
6. **类型安全（#9/#11/#12）**：逐步消除 44 处 `any`，`SubNav` 泛型化，去除 `as any` 强转。
7. **删除死代码（#7/#10/#14/#22）**：`MoodRecordScript.ts`、`moodRecordStore` 死分支、冗余 `token`、DEV 调试 `console.log`。
8. **巨型组件拆分（#21/#24/#16）**：拆分 >1000 行 SFC/store；静态数据（情绪选项/推荐规则）与本地统计计算下沉到 `constants`/`utils` 纯函数。
9. **角色常量集中（#19）**：`roles` 提升到 `constants`/`types`，消除双定义。
10. **测试增强（#20 + 覆盖率）**：组件挂载测试补齐 `router-link` stub；为 relax/*、admin/*、user/*、improve/* 关键 views 补单测；维持现有 205 用例绿态。

---

### 一句话结论
报告已写入 `D:\桌面\ccooddee\review_output\frontend.md`；最关键 3 个发现：① 拦截器统一抛出无 `.response` 的 `ApiRequestError`，但多个 store/api 仍读 `err.response` 导致真实错误信息丢失且 AI 限流冷却分支失效（#1/#2）；② `Courses.vue`/`CourseDetail.vue` 用裸 `fetch` 未解包 ApiResponse 信封、未带凭证，课程列表/详情存在渲染损坏风险（#3/#4）；③ `.env` 的 feature-flag 变量名与代码读取名不匹配，导致非核心模块开关在生产环境永远默认开启（#5）。
