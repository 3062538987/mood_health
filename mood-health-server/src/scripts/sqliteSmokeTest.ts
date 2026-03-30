import dotenv from 'dotenv'

const fetch = require('node-fetch')

dotenv.config()

const API_BASE_URL =
  process.env.API_BASE_URL || process.env.DEMO_API_BASE_URL || 'http://127.0.0.1:3000'
const PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'Pass123456'

const toJson = (body: unknown) => JSON.stringify(body)

const assertOk = async (res: any, step: string) => {
  const text = await res.text()
  let payload: any = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`${step} 响应非 JSON: ${text}`)
  }

  if (!res.ok || !payload || payload.code !== 0) {
    throw new Error(`${step} 失败: HTTP ${res.status}, body=${text}`)
  }

  return payload
}

const request = async (path: string, options: any = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, options)
  return res
}

const main = async () => {
  const suffix = Date.now()
  const username = `sqlite_smoke_${suffix}`
  const email = `${username}@example.com`

  console.log(`开始 SQLite 冒烟测试, API: ${API_BASE_URL}`)

  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: toJson({ username, email, password: PASSWORD }),
  })
  await assertOk(registerRes, '注册')

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: toJson({ username, password: PASSWORD }),
  })
  const loginBody = await assertOk(loginRes, '登录')
  const token = loginBody.data?.token as string

  if (!token) {
    throw new Error('登录返回缺少 token')
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const moodTypesRes = await request('/api/moods/types', {
    method: 'GET',
    headers: authHeaders,
  })
  const moodTypes = await assertOk(moodTypesRes, '获取情绪类型')
  const firstEmotionTypeId = moodTypes.data?.[0]?.id

  if (!firstEmotionTypeId) {
    throw new Error('情绪类型为空，无法继续测试')
  }

  const createTagRes = await request('/api/moods/tags', {
    method: 'POST',
    headers: authHeaders,
    body: toJson({ name: '冒烟标签' }),
  })
  const createTagBody = await assertOk(createTagRes, '创建情绪标签')
  const tagId = createTagBody.data?.id

  const today = new Date().toISOString().slice(0, 10)
  const recordMoodRes = await request('/api/moods/record', {
    method: 'POST',
    headers: authHeaders,
    body: toJson({
      emotions: [{ emotionTypeId: firstEmotionTypeId, intensity: 7 }],
      tagIds: tagId ? [tagId] : [],
      trigger: '冒烟测试触发因素',
      event: '冒烟测试事件',
      recordDate: today,
    }),
  })
  await assertOk(recordMoodRes, '记录心情')

  const createPostRes = await request('/api/posts', {
    method: 'POST',
    headers: authHeaders,
    body: toJson({
      title: 'SQLite 冒烟帖子',
      content: '这是一条 SQLite 冒烟测试帖子',
      isAnonymous: false,
    }),
  })
  const createPostBody = await assertOk(createPostRes, '创建帖子')
  const postId = createPostBody.data?.id

  if (!postId) {
    throw new Error('创建帖子返回缺少 id')
  }

  const createCommentRes = await request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders,
    body: toJson({ content: 'SQLite 冒烟评论', isAnonymous: false }),
  })
  await assertOk(createCommentRes, '创建评论')

  const likePostRes = await request(`/api/posts/${postId}/like`, {
    method: 'POST',
    headers: authHeaders,
  })
  await assertOk(likePostRes, '点赞帖子')

  const adviceSaveRes = await request('/api/moods/advice/save', {
    method: 'POST',
    headers: authHeaders,
    body: toJson({ analysis: '冒烟测试分析', suggestions: ['建议一', '建议二'] }),
  })
  await assertOk(adviceSaveRes, '保存建议历史')

  console.log('✅ SQLite 冒烟测试通过')
}

main().catch((error) => {
  console.error('❌ SQLite 冒烟测试失败:', error)
  process.exit(1)
})
