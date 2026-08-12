<template>
  <main class="knowledge-page">
    <section class="hero" aria-labelledby="knowledge-title">
      <div>
        <p class="eyebrow">心理健康知识库</p>
        <h1 id="knowledge-title">从可靠资料开始，照顾好每一种情绪</h1>
        <p class="hero-copy">平台内置资料均保留来源与授权信息，老师上传的资料也会集中显示在这里。</p>
      </div>
      <div class="hero-stat" aria-label="资料统计">
        <strong>{{ total }}</strong>
        <span>份可用资料</span>
      </div>
    </section>

    <section class="workspace">
      <aside class="folder-panel" aria-label="资料文件夹">
        <div class="panel-title">
          <span>资料文件夹</span>
          <span class="folder-count">{{ folders.length }}</span>
        </div>
        <button
          class="folder-button"
          :class="{ active: selectedFolderId === undefined }"
          type="button"
          @click="selectFolder(undefined)"
        >
          <span class="folder-icon">全</span>
          <span>
            <strong>全部资料</strong>
            <small>查看所有可用内容</small>
          </span>
        </button>
        <button
          v-for="folder in folders"
          :key="folder.id"
          class="folder-button"
          :class="{ active: selectedFolderId === folder.id }"
          type="button"
          @click="selectFolder(folder.id)"
        >
          <span class="folder-icon">{{ folder.isBuiltin ? '内' : '资' }}</span>
          <span>
            <strong>{{ folder.name }}</strong>
            <small>{{ folder.description || '老师共享的学习资料' }}</small>
          </span>
          <span v-if="folder.isBuiltin" class="builtin-badge">内置</span>
        </button>
      </aside>

      <section class="resource-panel" aria-live="polite">
        <div class="toolbar">
          <div>
            <h2>{{ activeFolderName }}</h2>
            <p>每一条资料都可以查看来源，避免无法验证的内容。</p>
          </div>
          <form class="search" role="search" @submit.prevent="searchResources">
            <label class="sr-only" for="knowledge-search">搜索资料</label>
            <input
              id="knowledge-search"
              v-model.trim="keyword"
              type="search"
              placeholder="搜索标题或简介"
            />
            <button type="submit">搜索</button>
          </form>
        </div>

        <div v-if="loading" class="state-card" data-test="resource-loading">
          <span class="spinner" aria-hidden="true"></span>
          <p>正在加载资料…</p>
        </div>

        <div v-else-if="loadError" class="state-card error-state" role="alert">
          <span class="state-icon">!</span>
          <h3>资源列表加载失败</h3>
          <p>{{ loadError }}</p>
          <button data-test="retry-resources" type="button" @click="loadResources">重新加载</button>
        </div>

        <div v-else-if="resources.length === 0" class="state-card">
          <span class="state-icon">空</span>
          <h3>暂时没有匹配的资料</h3>
          <p>可以更换文件夹或清空搜索词后再试。</p>
        </div>

        <div v-else class="resource-grid">
          <article
            v-for="resource in resources"
            :key="resource.id"
            class="resource-card"
            tabindex="0"
            @click="selectedResource = resource"
            @keydown.enter="selectedResource = resource"
          >
            <div class="card-heading">
              <span class="type-badge">{{ resourceTypeLabel(resource.resourceType) }}</span>
              <span v-if="resource.isBuiltin" class="builtin-badge">内置资料</span>
            </div>
            <h3>{{ resource.title }}</h3>
            <p>{{ resource.summary }}</p>
            <div class="resource-meta">
              <span>{{ resource.folderSlug === 'builtin' ? '平台审核' : '老师共享' }}</span>
              <span>{{ resource.licenseCode }}</span>
            </div>
            <div class="card-actions">
              <a
                v-if="resource.sourceUrl"
                data-test="resource-source"
                :href="resource.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                查看权威来源
              </a>
              <span v-else class="source-unavailable">来源待补充</span>
              <button
                class="favorite-button"
                :class="{ active: resource.favorited }"
                :data-test="`favorite-${resource.id}`"
                :aria-label="resource.favorited ? `取消收藏${resource.title}` : `收藏${resource.title}`"
                :aria-pressed="resource.favorited"
                type="button"
                @click.stop="toggleFavorite(resource)"
              >
                {{ resource.favorited ? '★ 已收藏' : '☆ 收藏' }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>

    <div v-if="selectedResource" class="detail-backdrop" @click.self="selectedResource = null">
      <section class="detail-panel" role="dialog" aria-modal="true" :aria-labelledby="`resource-${selectedResource.id}`">
        <button class="detail-close" type="button" aria-label="关闭资料详情" @click="selectedResource = null">×</button>
        <span class="type-badge">{{ resourceTypeLabel(selectedResource.resourceType) }}</span>
        <h2 :id="`resource-${selectedResource.id}`">{{ selectedResource.title }}</h2>
        <p>{{ selectedResource.summary }}</p>
        <dl>
          <div><dt>资料目录</dt><dd>{{ selectedResource.folderSlug === 'builtin' ? '内置资料' : '共享资料' }}</dd></div>
          <div><dt>授权信息</dt><dd>{{ selectedResource.licenseCode }}</dd></div>
          <div><dt>收录状态</dt><dd>{{ selectedResource.ingestionStatus === 'ready' ? '可用' : '处理中' }}</dd></div>
        </dl>
        <a
          v-if="selectedResource.sourceUrl"
          class="primary-link"
          :href="selectedResource.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          前往原始资料
        </a>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getKnowledgeFolders,
  getKnowledgeResources,
  setKnowledgeResourceFavorite,
  type KnowledgeFolder,
  type KnowledgeResource,
  type KnowledgeResourceType,
} from '@/api/knowledgeResources'
import { getErrorMessage } from '@/utils/request'

const folders = ref<KnowledgeFolder[]>([])
const resources = ref<KnowledgeResource[]>([])
const selectedFolderId = ref<number | undefined>()
const selectedResource = ref<KnowledgeResource | null>(null)
const keyword = ref('')
const total = ref(0)
const loading = ref(true)
const loadError = ref('')

const activeFolderName = computed(() =>
  selectedFolderId.value === undefined
    ? '全部资料'
    : folders.value.find((folder) => folder.id === selectedFolderId.value)?.name || '资料列表'
)

const resourceTypeLabel = (type: KnowledgeResourceType) => ({
  article: '文章',
  document: '文档',
  link: '网页',
  video: '视频',
})[type]

const loadResources = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getKnowledgeResources({
      folderId: selectedFolderId.value,
      keyword: keyword.value || undefined,
      pageSize: 50,
    })
    resources.value = result.items
    total.value = result.total
  } catch (error) {
    resources.value = []
    total.value = 0
    loadError.value = getErrorMessage(error, '请求失败，请检查服务后重试')
  } finally {
    loading.value = false
  }
}

const loadPage = async () => {
  try {
    folders.value = await getKnowledgeFolders()
  } catch (error) {
    loadError.value = getErrorMessage(error, '文件夹加载失败，请稍后重试')
  }
  await loadResources()
}

const selectFolder = (folderId: number | undefined) => {
  selectedFolderId.value = folderId
  selectedResource.value = null
  void loadResources()
}

const searchResources = () => {
  selectedResource.value = null
  void loadResources()
}

const toggleFavorite = async (resource: KnowledgeResource) => {
  const nextFavorite = !resource.favorited
  try {
    const result = await setKnowledgeResourceFavorite(resource.id, nextFavorite)
    resource.favorited = result.favorite
  } catch (error) {
    loadError.value = getErrorMessage(error, '收藏操作失败，请重试')
  }
}

onMounted(() => {
  void loadPage()
})
</script>

<style scoped lang="scss">
.knowledge-page { min-height: 100%; padding: 32px; color: #24352f; background: #f4f7f5; }
.hero { max-width: 1280px; margin: 0 auto 24px; padding: 32px 38px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-radius: 24px; color: #fff; background: linear-gradient(125deg, #235f4c, #3f8a6f); box-shadow: 0 16px 40px rgba(35, 95, 76, .18); }
.eyebrow { margin: 0 0 8px; font-size: 13px; letter-spacing: .18em; opacity: .82; }
.hero h1 { max-width: 720px; margin: 0; font-size: clamp(26px, 4vw, 42px); line-height: 1.2; }
.hero-copy { max-width: 680px; margin: 14px 0 0; line-height: 1.7; opacity: .86; }
.hero-stat { min-width: 128px; padding: 18px; text-align: center; border-radius: 18px; background: rgba(255,255,255,.14); }
.hero-stat strong { display: block; font-size: 36px; }.hero-stat span { font-size: 13px; opacity: .82; }
.workspace { max-width: 1280px; margin: auto; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 22px; }
.folder-panel, .resource-panel { border: 1px solid #e2eae6; border-radius: 20px; background: #fff; box-shadow: 0 8px 30px rgba(41, 67, 57, .06); }
.folder-panel { align-self: start; padding: 18px; }.panel-title { padding: 4px 8px 14px; display: flex; justify-content: space-between; font-weight: 700; }.folder-count { color: #678077; }
.folder-button { width: 100%; padding: 12px; display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 10px; border: 0; border-radius: 13px; color: #40554d; text-align: left; background: transparent; cursor: pointer; }
.folder-button:hover, .folder-button.active { color: #1f654e; background: #edf7f2; }.folder-button strong, .folder-button small { display: block; }.folder-button small { margin-top: 3px; overflow: hidden; color: #7b8d86; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.folder-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; color: #267057; background: #dff1e9; font-weight: 700; }
.builtin-badge, .type-badge { display: inline-flex; padding: 4px 9px; border-radius: 99px; color: #28674f; background: #e4f3ec; font-size: 12px; font-weight: 700; }
.resource-panel { min-height: 520px; padding: 24px; }.toolbar { margin-bottom: 22px; display: flex; justify-content: space-between; gap: 18px; }.toolbar h2 { margin: 0 0 5px; font-size: 24px; }.toolbar p { margin: 0; color: #71817a; font-size: 14px; }
.search { display: flex; align-self: center; }.search input { width: 220px; padding: 10px 13px; border: 1px solid #d6e1dc; border-radius: 10px 0 0 10px; outline: none; }.search input:focus { border-color: #3f8a6f; }.search button, .state-card button { padding: 10px 16px; border: 0; border-radius: 0 10px 10px 0; color: #fff; background: #32765e; cursor: pointer; }
.resource-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.resource-card { padding: 20px; border: 1px solid #e4ebe7; border-radius: 16px; background: #fff; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }.resource-card:hover, .resource-card:focus { border-color: #9bc9b7; outline: none; transform: translateY(-2px); box-shadow: 0 10px 24px rgba(44, 93, 74, .1); }
.card-heading, .card-actions, .resource-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.resource-card h3 { margin: 15px 0 8px; font-size: 18px; line-height: 1.45; }.resource-card > p { min-height: 46px; margin: 0; color: #677871; font-size: 14px; line-height: 1.65; }.resource-meta { margin: 17px 0; padding-top: 13px; border-top: 1px solid #edf1ef; color: #8a9892; font-size: 12px; }.card-actions a { color: #267057; font-size: 13px; font-weight: 700; text-decoration: none; }.source-unavailable { color: #9aa59f; font-size: 13px; }
.favorite-button { padding: 7px 10px; border: 1px solid #d9e4df; border-radius: 9px; color: #61736c; background: #fff; cursor: pointer; }.favorite-button.active { border-color: #e8b96d; color: #976119; background: #fff8e8; }
.state-card { min-height: 330px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #73827c; text-align: center; }.state-card h3 { margin: 12px 0 4px; color: #3b4c45; }.state-card p { margin: 0 0 15px; }.state-card button { border-radius: 10px; }.state-icon { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; color: #32765e; background: #e7f3ee; font-weight: 800; }.error-state .state-icon { color: #a04444; background: #faeaea; }.spinner { width: 30px; height: 30px; border: 3px solid #dfece7; border-top-color: #32765e; border-radius: 50%; animation: spin .8s linear infinite; }
.detail-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; background: rgba(22, 35, 30, .34); }.detail-panel { width: min(520px, 92vw); height: 100%; padding: 42px 34px; position: relative; overflow: auto; background: #fff; box-shadow: -15px 0 40px rgba(0,0,0,.12); }.detail-panel h2 { margin: 20px 0 14px; font-size: 28px; line-height: 1.35; }.detail-panel > p { color: #63746d; line-height: 1.8; }.detail-close { position: absolute; top: 20px; right: 22px; border: 0; font-size: 30px; background: transparent; cursor: pointer; }.detail-panel dl { margin: 28px 0; }.detail-panel dl div { padding: 13px 0; display: flex; justify-content: space-between; border-bottom: 1px solid #edf1ef; }.detail-panel dt { color: #788780; }.detail-panel dd { margin: 0; font-weight: 700; }.primary-link { display: inline-flex; padding: 12px 18px; border-radius: 10px; color: #fff; background: #32765e; text-decoration: none; }
.sr-only { width: 1px; height: 1px; padding: 0; position: absolute; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .knowledge-page { padding: 18px; }.workspace { grid-template-columns: 1fr; }.folder-panel { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }.panel-title { grid-column: 1 / -1; }.resource-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .hero { padding: 25px; }.hero-stat { display: none; }.toolbar { flex-direction: column; }.search input { width: 100%; }.folder-panel { grid-template-columns: 1fr; }.resource-panel { padding: 18px; }.card-actions { align-items: flex-start; flex-direction: column; } }
</style>
