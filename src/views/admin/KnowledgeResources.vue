<template>
  <div class="admin-knowledge-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">知识库运营</p>
        <h2>资料管理</h2>
        <p>查看平台内置资料和老师共享资料，上传后会真实进入用户知识库。</p>
      </div>
      <button type="button" :disabled="loading" @click="load">{{ loading ? '刷新中…' : '刷新列表' }}</button>
    </header>

    <KnowledgeUploadForm @uploaded="handleUploaded" />

    <section class="summary-grid" aria-label="资料概况">
      <div><strong>{{ total }}</strong><span>资料总数</span></div>
      <div><strong>{{ builtinCount }}</strong><span>内置资料</span></div>
      <div><strong>{{ folders.length }}</strong><span>资料文件夹</span></div>
    </section>

    <section class="resource-section">
      <div class="section-heading">
        <h3>当前资料</h3>
        <label>
          <span class="sr-only">筛选资料目录</span>
          <select v-model="folderId" @change="load">
            <option value="">全部文件夹</option>
            <option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">
              {{ folder.name }}{{ folder.isBuiltin ? '（内置）' : '' }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="error" class="state error" role="alert">
        <p>{{ error }}</p>
        <button type="button" @click="load">重试</button>
      </div>
      <div v-else-if="loading" class="state">正在加载真实资料列表…</div>
      <div v-else-if="resources.length === 0" class="state">当前文件夹还没有资料</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>资料</th><th>文件夹</th><th>来源</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="resource in resources" :key="resource.id">
              <td><strong>{{ resource.title }}</strong><small>{{ resource.summary }}</small></td>
              <td><span :class="['badge', { builtin: resource.isBuiltin }]">{{ folderName(resource.folderId) }}</span></td>
              <td>{{ resource.licenseCode }}</td>
              <td>{{ resource.ingestionStatus === 'ready' ? '可用' : '处理中' }}</td>
              <td>
                <a v-if="resource.sourceUrl" :href="resource.sourceUrl" target="_blank" rel="noopener noreferrer">原始来源</a>
                <a v-else-if="resource.downloadUrl" :href="resource.downloadUrl">下载文件</a>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import KnowledgeUploadForm from '@/components/knowledge/KnowledgeUploadForm.vue'
import {
  getKnowledgeFolders,
  getKnowledgeResources,
  type KnowledgeFolder,
  type KnowledgeResource,
} from '@/api/knowledgeResources'
import { getErrorMessage } from '@/utils/request'

defineOptions({ name: 'AdminKnowledgeResources' })

const folders = ref<KnowledgeFolder[]>([])
const resources = ref<KnowledgeResource[]>([])
const folderId = ref('')
const total = ref(0)
const loading = ref(false)
const error = ref('')
const builtinCount = computed(() => resources.value.filter((item) => item.isBuiltin).length)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [folderResult, resourceResult] = await Promise.all([
      getKnowledgeFolders(),
      getKnowledgeResources({
        folderId: folderId.value ? Number(folderId.value) : undefined,
        pageSize: 100,
      }),
    ])
    folders.value = folderResult
    resources.value = resourceResult.items
    total.value = resourceResult.total
  } catch (loadError) {
    error.value = getErrorMessage(loadError, '资料列表加载失败，请重试')
  } finally {
    loading.value = false
  }
}

const folderName = (id: number) => folders.value.find((folder) => folder.id === id)?.name || '共享资料'
const handleUploaded = () => void load()
onMounted(() => void load())
</script>

<style scoped lang="scss">
.admin-knowledge-page { max-width: 1180px; margin: 0 auto; color: #263a32; }.page-header { margin-bottom: 18px; display: flex; justify-content: space-between; gap: 20px; }.eyebrow { margin: 0 0 4px; color: #397c65; font-size: 12px; font-weight: 800; letter-spacing: .14em; }.page-header h2 { margin: 0; font-size: 28px; }.page-header p:last-child { margin: 7px 0 0; color: #75847e; }.page-header button, .state button { align-self: center; padding: 10px 16px; border: 1px solid #a7c5b8; border-radius: 10px; color: #2b6d55; background: #fff; cursor: pointer; }
.summary-grid { margin: 18px 0; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }.summary-grid div { padding: 17px 20px; border: 1px solid #e0e8e4; border-radius: 14px; background: #fff; }.summary-grid strong, .summary-grid span { display: block; }.summary-grid strong { font-size: 27px; }.summary-grid span { margin-top: 3px; color: #76867f; font-size: 13px; }
.resource-section { padding: 20px; border: 1px solid #e0e8e4; border-radius: 16px; background: #fff; }.section-heading { margin-bottom: 14px; display: flex; justify-content: space-between; }.section-heading h3 { margin: 0; }.section-heading select { padding: 8px 11px; border: 1px solid #d2dfd9; border-radius: 9px; background: #fff; }.table-wrap { overflow-x: auto; }table { width: 100%; border-collapse: collapse; }th, td { padding: 13px 10px; border-bottom: 1px solid #edf1ef; text-align: left; font-size: 13px; }th { color: #718179; font-weight: 700; }td strong, td small { display: block; }td small { max-width: 360px; margin-top: 4px; color: #7b8983; line-height: 1.5; }.badge { padding: 4px 8px; border-radius: 99px; color: #5b6b65; background: #eef2f0; }.badge.builtin { color: #2b6d55; background: #e7f4ee; }td a { color: #2c7258; font-weight: 700; text-decoration: none; }.state { padding: 38px; color: #788781; text-align: center; }.state.error { color: #9a3f3f; background: #fff2f2; }.sr-only { width: 1px; height: 1px; position: absolute; overflow: hidden; clip: rect(0,0,0,0); }
@media (max-width: 700px) { .page-header { flex-direction: column; }.page-header button { align-self: flex-start; }.summary-grid { grid-template-columns: 1fr; } }
</style>
