# mood_health 情绪健康管理平台 — 全量评审报告

> 评审日期：2026-07-16  
> 评审范围：后端（Express + TypeScript）+ 前端（Vue3 + TypeScript）  
> 评审维度：功能链路故障扫描 + UI/UX 交互体验深度评审

---

## 目录

- [第一部分：P0 阻断BUG（功能缺陷）](#第一部分p0-阻断bug功能缺陷)
  - [P0-1：情绪档案删除记录仅操作前端状态，未调用后端API](#p0-1情绪档案删除记录仅操作前端状态未调用后端api)
  - [P0-2：问卷提交时前端传参格式与后端期望不匹配](#p0-2问卷提交时前端传参格式与后端期望不匹配)
  - [P0-3：参数校验中间件返回格式不一致，前端无法正确解析错误](#p0-3参数校验中间件返回格式不一致前端无法正确解析错误)
  - [P0-4：账号注销仅清除前端 localStorage，未调用后端API](#p0-4账号注销仅清除前端-localstorage未调用后端api)
  - [P0-5：getMoodTypes 和 getTagsHandler 返回格式不一致](#p0-5getmoodtypes-和-gettashandler-返回格式不一致)
  - [P0-6：MoodLayout.vue 缺少 TypeScript 类型约束](#p0-6moodlayoutvue-缺少-typescript-类型约束)
- [第二部分：P1 交互严重缺陷](#第二部分p1-交互严重缺陷)
  - [P1-1：问卷列表页无加载状态、无空状态、无请求失败提示](#p1-1问卷列表页无加载状态无空状态无请求失败提示)
  - [P1-2：问卷填写页提交失败后，所有答题数据丢失](#p1-2问卷填写页提交失败后所有答题数据丢失)
  - [P1-3：注册页错误信息重复显示](#p1-3注册页错误信息重复显示)
  - [P1-4：登录成功后缺少反馈提示](#p1-4登录成功后缺少反馈提示)
  - [P1-5：情绪记录提交按钮条件过于宽松](#p1-5情绪记录提交按钮条件过于宽松)
  - [P1-6：设置页保存操作无任何反馈](#p1-6设置页保存操作无任何反馈)
  - [P1-7：咨询对话页发送失败后输入框状态不明确](#p1-7咨询对话页发送失败后输入框状态不明确)
- [第三部分：P2 UI优化建议](#第三部分p2-ui优化建议)
  - [P2-1：登录/注册页缺少表单实时校验](#p2-1登录注册页缺少表单实时校验)
  - [P2-2：问卷页选项按钮缺少键盘导航支持](#p2-2问卷页选项按钮缺少键盘导航支持)
  - [P2-3：首页未登录时也会请求情绪数据](#p2-3首页未登录时也会请求情绪数据)
  - [P2-4：移动端底部导航栏入口不足](#p2-4移动端底部导航栏入口不足)
  - [P2-5：情绪档案卡片删除按钮对比度低](#p2-5情绪档案卡片删除按钮对比度低)
  - [P2-6：首页缺少新用户引导内容](#p2-6首页缺少新用户引导内容)
  - [P2-7：全局色彩统一度问题](#p2-7全局色彩统一度问题)
  - [P2-8：Token 过期后重定向不保留当前路径](#p2-8token-过期后重定向不保留当前路径)
  - [P2-9：问卷答题页移动端导航按钮位置](#p2-9问卷答题页移动端导航按钮位置)
  - [P2-10：情绪记录页 placeholder 文案优化](#p2-10情绪记录页-placeholder-文案优化)
- [评审总结](#评审总结)

---

## 第一部分：P0 阻断BUG（功能缺陷）

> 以下问题会导致数据不一致、接口500、用户操作无效等硬性阻断，必须优先修复。

---

### P0-1：情绪档案删除记录仅操作前端状态，未调用后端API

**文件位置**：`src/views/mood/MoodArchive.vue` 第 693-714 行

**问题描述**：`confirmDeleteRecord` 函数在确认删除后，仅从本地 `moodRecords` 数组中 splice 掉该项，完全没有调用后端 `DELETE /api/moods/:id` 接口。刷新页面后被"删除"的记录会重新出现。

**用户会遇到什么困惑**：用户以为删除了情绪记录，但刷新页面后记录又回来了，产生数据不可靠的认知，严重损害用户信任。

**根因**：缺少 `deleteMoodRecord` API 调用。

**修复代码**：

```typescript
// MoodArchive.vue script setup 中新增 import
import { deleteMoodRecord } from '@/api/mood'

// 修改 confirmDeleteRecord 函数（约第693行）
const confirmDeleteRecord = (record: MoodRecord) => {
  ElMessageBox.confirm('确定要删除这条情绪记录吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteMoodRecord(record.id)  // ← 新增：调用后端 API
        const index = moodRecords.value.findIndex((r) => r.id === record.id)
        if (index > -1) {
          moodRecords.value.splice(index, 1)
        }
        totalRecords.value = Math.max(0, totalRecords.value - 1)
        ElMessage.success('记录删除成功！')
      } catch (error) {
        console.error('删除失败', error)
        ElMessage.error('删除失败，请稍后再试')
      }
    })
    .catch(() => {
      // 取消删除
    })
}
```

同时需要确保 `src/api/mood.ts` 中已有 `deleteMoodRecord` 函数，若没有则需新增：

```typescript
// src/api/mood.ts
import request from '@/utils/request'

export const deleteMoodRecord = (id: number) =>
  request({ url: `/api/moods/${id}`, method: 'DELETE' })
```

---

### P0-2：问卷提交时前端传参格式与后端期望不匹配

**文件位置**：
- 前端：`src/views/improve/Questionnaire.vue` 第 124-127 行
- 后端路由校验：`mood_health_server/src/routes/questionnaireRoutes.ts` 第 29-33 行

**问题描述**：前端 `submitAssessment` 将 `answers` 传递为 `number[]`（即 `selectedAnswers.value` 是 `[-1, 0, 2, 1, ...]` 这样的纯数字数组），而后端路由校验期望 `answers` 是 `[{ itemId: number, score: number }]` 对象数组。express-validator 会校验失败返回 400，或者如果跳过了校验，`assessmentService.submitAssessment` 中 `answers.map(a => ({ itemId: a.itemId, score: a.score }))` 会因 `a.itemId` 为 `undefined` 导致后续 SQL 异常。

**用户会遇到什么困惑**：填写完所有问卷题目后点击提交，看到"提交答案失败，请稍后重试"的错误提示，所有答题内容丢失，需要重新填写。

**根因**：前端 `selectedAnswers` 只存储了选项索引（0/1/2/3），没有存储题目 ID（itemId）。

**修复代码**：

```typescript
// Questionnaire.vue — 修改 submitAssessment 调用（约第124-127行）
const res = await submitAssessment({
  questionnaire_id: questionnaireId.value,
  answers: selectedAnswers.value.map((score, index) => ({
    itemId: questions.value[index]?.id,  // ← 需要题目 ID
    score: score,
  })),
})
```

> 注意：需要确认 `questions.value` 中每个条目的 `id` 字段有值（来自 `getQuestionnaireQuestions` API 返回的数据）。

---

### P0-3：参数校验中间件返回格式不一致，前端无法正确解析错误

**文件位置**：`mood_health_server/src/middleware/validateRequest.ts` 第 4-10 行

**问题描述**：`validateRequest` 直接返回 `{ code: 400, message: '参数验证失败', details: errors.array() }`，没有使用 `apiFailure()` 工具函数。这导致前端 `unwrapResponse` 遇到 `code: 400`（非0）时抛出 `ApiRequestError`，但 `details` 字段丢失，用户只会看到"参数验证失败"的笼统提示，无法知道具体哪个字段错了。

**用户会遇到什么困惑**：提交表单时看到"参数验证失败"但不清楚哪里填错了，反复尝试仍然失败，产生强烈的挫败感。

**修复代码**：

```typescript
// validateRequest.ts
import { validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import { apiFailure } from '../utils/apiResponse'

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0]
    const message = firstError?.msg || '参数验证失败'
    return res.status(400).json(apiFailure(400, message))
  }
  next()
}
```

---

### P0-4：账号注销仅清除前端 localStorage，未调用后端API

**文件位置**：`src/views/user/Setting.vue` 第 311-315 行

**问题描述**：`deleteAccount` 函数仅执行 `localStorage.clear()` 并显示"账号注销申请已提交"的提示，未调用后端任何删除/注销接口。用户数据仍然完整保留在数据库中。

**用户会遇到什么困惑**：用户以为账号已注销、数据已删除，实际数据仍在服务端。这违反了隐私声明中"7个工作日内永久删除"的承诺，存在隐私合规风险。

**修复代码**：

```typescript
// Setting.vue — 修改 deleteAccount 函数
import request from '@/utils/request'
import { useRouter } from 'vue-router'

const router = useRouter()

const deleteAccount = async () => {
  try {
    // 调用后端注销接口
    await request({ url: '/api/users/me', method: 'DELETE' })
    localStorage.clear()
    showDeleteConfirmModal.value = false
    ElMessage.success('账号注销申请已提交，所有个人数据将在7个工作日内永久删除。')
    router.push('/login')
  } catch (error: any) {
    ElMessage.error(error?.message || '注销失败，请稍后再试')
  }
}
```

> 注意：需要确认后端是否有 `DELETE /api/users/me` 接口。若没有，可利用已有的 `managementController.adminUsersDeleteHandler` 逻辑或新增自注销端点。

---

### P0-5：getMoodTypes 和 getTagsHandler 返回格式不一致

**文件位置**：`mood_health_server/src/controllers/moodController.ts` 第 261-307 行

**问题描述**：`getMoodTypes`、`getTagsHandler` 和 `createTagHandler` 直接返回 `{ code: 0, data: ..., message: '获取成功' }`，而其他所有接口都使用 `apiSuccess()` 包装。虽然字段名相同，但写法不统一，且错误时返回 `{ code: 500, message: '服务器错误' }` 缺少 `data` 字段，与 `apiFailure()` 的 `{ code, message, data }` 格式不一致。

**用户会遇到什么困惑**：前端如果对这两个接口的响应格式有特殊处理，可能导致数据解析失败或类型错误。

**修复代码**：

```typescript
// moodController.ts — getMoodTypes（约第261行）
export const getMoodTypes = async (req: AuthRequest, res: Response) => {
  try {
    const emotionTypes = await moodService.listEmotionTypes()
    const formattedTypes = emotionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      category: type.category,
    }))
    res.json(apiSuccess(formattedTypes, '获取成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

// getTagsHandler 同样修改
export const getTagsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const tags = await moodService.listTags(userId)
    res.json(apiSuccess(tags, '获取成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

// createTagHandler 同样修改
export const createTagHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { name } = req.body
    if (!name || typeof name !== 'string') {
      return res.status(400).json(apiFailure(400, '标签名称不能为空'))
    }
    const tag = await moodService.createOrGetTag(name.trim(), userId)
    res.status(201).json(apiSuccess(tag, '创建成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}
```

---

### P0-6：MoodLayout.vue 缺少 TypeScript 类型约束

**文件位置**：`src/views/mood/MoodLayout.vue` 第 9 行

**问题描述**：`<script setup>` 缺少 `lang="ts"`，导致 `route.meta.subNav` 的 `items` 参数隐式为 `any`，`filter` 回调中的 `item` 也没有类型约束。项目整体使用 TypeScript，此处却使用了纯 JavaScript。

**修复代码**：

```vue
<!-- 第9行 -->
<script setup lang="ts">
```

---

## 第二部分：P1 交互严重缺陷

> 以下问题影响正常使用体验，如缺少 loading 反馈、无错误提示、数据丢失等。

---

### P1-1：问卷列表页无加载状态、无空状态、无请求失败提示

**文件位置**：`src/views/improve/QuestionnaireList.vue` 第 37-81 行

**问题描述**：`fetchQuestionnaires` 和 `fetchCompletedIds` 失败时仅 `console.error`，用户完全不知道加载失败。页面初始状态为空白卡片区域，无 loading 动画，也无"暂无问卷"的空状态提示。

**用户会遇到什么困惑**：进入问卷列表页看到空白，不知道是正在加载还是加载失败了，可能会反复刷新页面。

**修改方案**：

1. 添加 `loading` 和 `loadError` 状态变量
2. 加载中显示骨架屏或 loading 组件
3. 加载失败显示错误提示 + 重试按钮
4. 问卷为空时显示空状态引导

**参考代码**：

```vue
<template>
  <div class="questionnaire-list">
    <div class="container">
      <h2>心理筛查问卷</h2>

      <!-- loading 状态 -->
      <SoftLoadingState
        v-if="loading"
        variant="cards"
        :item-count="3"
        title="正在加载问卷列表"
      />

      <!-- 错误状态 -->
      <div v-else-if="loadError" class="error-state">
        <p>加载失败：{{ loadError }}</p>
        <button class="btn primary" @click="retry">重试</button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="questionnaires.length === 0" class="empty-state">
        <p>暂无可用的心理筛查问卷</p>
      </div>

      <!-- 正常内容 -->
      <template v-else>
        <!-- 原有内容 ... -->
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SoftLoadingState from '@/components/shared/SoftLoadingState.vue'

const loading = ref(true)
const loadError = ref('')

const retry = () => {
  fetchQuestionnaires()
  fetchCompletedIds()
}

const fetchQuestionnaires = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getQuestionnaires()
    questionnaires.value = res
  } catch (error: any) {
    loadError.value = error?.message || '获取量表列表失败'
  } finally {
    loading.value = false
  }
}
</script>
```

---

### P1-2：问卷填写页提交失败后，所有答题数据丢失

**文件位置**：`src/views/improve/Questionnaire.vue` 第 136-139 行

**问题描述**：`nextQuestion` 提交失败时仅 `ElMessage.error`，没有保留答题数据。如果网络波动导致提交失败，用户需要重新作答所有题目。

**用户会遇到什么困惑**：辛辛苦苦填完 20 道题，点击提交后网络超时，所有答案丢失，需要重来，极大概率导致用户放弃。

**修改方案**：

1. 提交失败时保留在当前页，不清空 `selectedAnswers`
2. 添加提交中状态防止重复提交
3. 考虑将答题进度保存到 `localStorage` 草稿

**参考代码**：

```typescript
const isSubmitting = ref(false)

const nextQuestion = async () => {
  if (selectedAnswer.value === -1) {
    ElMessage.warning('请选择一个答案')
    return
  }

  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  } else {
    if (isSubmitting.value) return  // 防止重复提交
    isSubmitting.value = true
    try {
      const res = await submitAssessment({
        questionnaire_id: questionnaireId.value,
        answers: selectedAnswers.value.map((score, index) => ({
          itemId: questions.value[index]?.id,
          score,
        })),
      })
      ElMessage.success('提交成功！')
      router.push({
        path: '/improve/questionnaire/result',
        query: { score: res.score.toString(), /* ... */ },
      })
    } catch (error) {
      ElMessage.error('提交失败，请检查网络后重试')
      // 保留在当前页面，不清空答案，用户可再次点击提交
    } finally {
      isSubmitting.value = false
    }
  }
}
```

---

### P1-3：注册页错误信息重复显示

**文件位置**：`src/views/auth/Register.vue` 第 48-53 行

**问题描述**：模板中同时渲染了 `error`（本地校验错误）和 `userStore.error`（服务端错误），两者可能同时出现。例如用户名已存在时，`userStore.error` 显示"用户名已存在"，同时本地校验的 `error` 可能为空，但用户看到两条错误区域会感到困惑。

**用户会遇到什么困惑**：看到多条错误信息，不清楚到底哪个是有效的错误提示。

**修改方案**：统一错误显示，优先显示本地校验错误，注册前清空 store 错误。

```typescript
const handleRegister = async () => {
  error.value = ''
  userStore.clearError() // 需要在 store 中添加此方法

  // 校验逻辑...

  const success = await userStore.register(form.username, form.password, email)
  if (success) {
    ElMessage.success('注册成功！请登录')
    router.push('/login')
  } else {
    error.value = userStore.error || '注册失败'
  }
}
```

---

### P1-4：登录成功后缺少反馈提示

**文件位置**：`src/views/auth/Login.vue` 第 54-59 行

**问题描述**：登录按钮有 `:disabled="userStore.loading"` 和文字切换，但登录成功后没有成功提示就直接跳转了。注册成功后有 `ElMessage.success` 但登录成功后无任何反馈。

**用户会遇到什么困惑**：登录成功后页面一闪就跳转了，不确定是否登录成功，可能以为登录失败而重复点击。

**修改方案**：登录成功后添加短暂的成功提示。

```typescript
const handleLogin = async () => {
  const success = await userStore.login(form.username, form.password)
  if (success) {
    ElMessage.success('登录成功')
    router.push('/')
  }
}
```

---

### P1-5：情绪记录提交按钮条件过于宽松

**文件位置**：`src/views/mood/MoodRecord.vue` 第 314 行

**问题描述**：`canSubmit` 仅判断 `!isSubmitting.value`，即只要不在提交中就可以点。用户可以不选情绪类型、不填内容直接提交，后端会返回 400 错误。

**用户会遇到什么困惑**：点击保存后看到"情绪类型和强度为必填"的错误提示，不明白为什么按钮可以点但又不让提交。

**修改方案**：至少要求选中一种情绪类型。

```typescript
const canSubmit = computed(() =>
  !isSubmitting.value && selectedMoodTypeIds.value.length > 0
)
```

---

### P1-6：设置页保存操作无任何反馈

**文件位置**：`src/views/user/Setting.vue` 第 287-298 行

**问题描述**：`saveSettings` 和 `saveNotifications` 直接写入 localStorage，没有任何成功/失败提示。用户切换开关后不知道是否生效。

**用户会遇到什么困惑**：切换了"周报推送"开关，不确定是否保存成功，可能会反复切换来确认。

**修改方案**：添加轻量提示。

```typescript
const saveSettings = () => {
  localStorage.setItem('reminderTime', reminderTime.value)
  localStorage.setItem('weeklyReport', JSON.stringify(weeklyReport.value))
  localStorage.setItem('gameSound', JSON.stringify(gameSound.value))
  soundManager.setSoundEnabled(gameSound.value)
  ElMessage.success('设置已保存')
}

const saveNotifications = () => {
  localStorage.setItem('notifications', JSON.stringify(notifications.value))
  ElMessage.success('通知设置已保存')
}
```

---

### P1-7：咨询对话页发送失败后输入框状态不明确

**文件位置**：`src/views/counseling/Counseling.vue` 第 229-231 行

**问题描述**：`sendToService` 中只有当 `inputMessage.value.trim() === inputSnapshot.trim()` 时才清空输入框。在 `sendMessage` 中，如果发送失败，`inputMessage` 可能已经被用户修改了，输入框不会清空。这是合理的设计（保留输入以便重试），但缺少明确的视觉提示告诉用户消息发送失败了。

**用户会遇到什么困惑**：消息发送失败后，输入框还保留着原来的文字，消息列表中有红色标记，但用户不确定是网络问题还是内容问题。

**修改方案**：发送失败时，在输入框下方显示明显的错误提示横幅。

---

## 第三部分：P2 UI优化建议

> 以下为视觉、排版、文案、无障碍等方面的优化建议，提升产品精致度。

---

### P2-1：登录/注册页缺少表单实时校验

**位置**：`src/views/auth/Login.vue` / `src/views/auth/Register.vue`

**建议**：当前仅在提交时校验。建议在输入框失去焦点（blur）时进行实时校验，并在输入框下方显示红色提示文字，而非页面顶部的 `error-message`。这样用户可以边输入边修正，体验更好。

**参考实现**：为每个输入框添加 `@blur` 校验 + 独立的 `fieldError` 状态。

---

### P2-2：问卷页选项按钮缺少键盘导航支持

**位置**：`src/views/improve/Questionnaire.vue` 第 23-31 行

**建议**：选项目前使用 `<div>` 而非 `<button>`，不支持 Tab 键导航和 Enter 键选择。应改为 `<button>` 元素，方便无障碍访问和键盘操作。

---

### P2-3：首页未登录时也会请求情绪数据

**位置**：`src/App.vue` 第 116-121 行

**建议**：当前 `onMounted` 中已判断 `userStore.isLoggedIn`，但如果用户 token 已过期，`moodStore.fetchMoodList` 会触发 401 错误提示。建议在请求前先验证 token 有效性，或静默处理 401（不在首页弹出错误）。

---

### P2-4：移动端底部导航栏入口不足

**位置**：`src/App.vue` 第 60-77 行

**建议**：移动端底部 TabBar 只有"首页/情绪/我的/后台"，缺少"提升"（问卷）和"咨询"等核心入口。建议增加到 5 个，或使用"更多"菜单收纳次要入口。

---

### P2-5：情绪档案卡片删除按钮对比度低

**位置**：`src/views/mood/MoodArchive.vue` 第 1048-1051 行

**建议**：`.delete-btn` 使用 `rgba(239, 71, 111, 0.12)` 背景色，在白色卡片上几乎看不到按钮边界。建议改为 `#ef476f` 文字色 + 透明背景 + 红色边框，使危险操作更加醒目。

```scss
.delete-btn {
  background: transparent;
  color: #ef476f;
  border: 1px solid #ef476f;
}
```

---

### P2-6：首页缺少新用户引导内容

**位置**：`src/views/Home.vue`

**建议**：新用户登录后首页如果没有情绪记录，应展示 onboarding 引导卡片（"去记录第一条情绪"、"完成心理筛查问卷"等快捷入口），而非空白页面。可参考 MoodArchive 中的 `SoftEmptyState` 组件。

---

### P2-7：全局色彩统一度问题

**位置**：多处

**建议**：

- 登录/注册页使用 `#667eea → #764ba2` 紫蓝渐变
- 情绪记录页使用 `#8b9dc3 → #c49a6c` 暖色系
- 咨询页使用 `#b996d8` 紫色系

三个主色调不统一，建议统一定义全局主题色变量（已存在 `var(--primary-color)` 等），各模块使用全局变量而非硬编码颜色。

---

### P2-8：Token 过期后重定向不保留当前路径

**位置**：`src/utils/request.ts` 第 158-162 行

**现状**：401 时直接 `router.push('/login')`，但不会保存当前页面路径。用户重新登录后会回到首页，而非之前操作的页面。

**建议**：跳转登录时携带 `redirect` 参数。

```typescript
case 401:
  message = '登录已过期，请重新登录'
  localStorage.removeItem('token')
  router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
  break
```

登录成功后读取 `redirect` 参数跳回原页面。

---

### P2-9：问卷答题页移动端导航按钮位置

**位置**：`src/views/improve/Questionnaire.vue` 第 234-247 行

**建议**：移动端"上一题/下一题"按钮在长问卷中需要滚动到底部才能看到，建议固定在屏幕底部（类似 MoodRecord 的 `action-panel` 处理方式），方便用户随时操作。

---

### P2-10：情绪记录页 placeholder 文案优化

**位置**：`src/views/mood/MoodRecord.vue` 第 138-140 行

**建议**：textarea 的 placeholder 文字较长（"可以从一件小事开始：今天什么时候开始觉得不舒服，或哪一刻突然轻松了？"），移动端可能截断。建议缩短为：

> "从一件小事开始：今天什么时候开始觉得不舒服？"

---

## 评审总结

| 级别 | 数量 | 关键问题 |
|------|------|----------|
| P0 阻断BUG | 6 | 删除记录不调API、问卷提交参数错配、校验中间件格式不一致、账号注销不调后端、响应格式不一致、MoodLayout缺少TS |
| P1 交互严重缺陷 | 7 | 问卷列表无loading/空状态/错误处理、提交失败丢答案、注册错误重复显示、登录无成功提示、提交按钮条件过宽、设置无反馈、咨询发送失败提示 |
| P2 UI优化建议 | 10 | 表单实时校验、无障碍、颜色统一、Token过期重定向、移动端适配、新用户引导、文案优化 |

**建议修复顺序**：

1. P0-1（删除记录不调API）
2. P0-2（问卷提交参数错配）
3. P0-4（账号注销不调后端）
4. P0-3（校验中间件格式）
5. P0-5（响应格式统一）
6. P0-6（TS类型修复）
7. P1-1 → P1-7（交互缺陷）
8. P2-1 → P2-10（UI优化）