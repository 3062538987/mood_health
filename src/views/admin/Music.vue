<template>
  <div class="admin-page">
    <div class="head">
      <h2>音乐管理</h2>
      <div class="head-actions">
        <button data-test="add-music" class="primary" type="button" @click="showCreate = true">添加音乐</button>
        <button :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <form v-if="showCreate" data-test="music-form" class="create-form" @submit.prevent="create">
      <div class="form-head"><h3>添加音乐</h3><button type="button" @click="showCreate = false">关闭</button></div>
      <input v-model.trim="draft.title" data-test="music-title" maxlength="255" placeholder="音乐名称" required />
      <input v-model.trim="draft.artist" data-test="music-artist" maxlength="255" placeholder="作者" required />
      <input v-model.trim="draft.url" data-test="music-url" type="url" maxlength="512" placeholder="HTTPS 音频地址" required />
      <input v-model.trim="draft.duration" data-test="music-duration" maxlength="32" placeholder="时长，例如 05:20" required />
      <input v-model.trim="draft.category" data-test="music-category" maxlength="64" placeholder="分类" required />
      <input v-model.trim="draft.cover" type="url" maxlength="512" placeholder="HTTPS 封面地址（可选）" />
      <button class="primary" type="submit" :disabled="creating">{{ creating ? '添加中…' : '确认添加' }}</button>
    </form>

    <div v-if="loading" class="state">正在加载音乐列表...</div>
    <div v-else-if="musicList.length === 0" class="state">还没有音乐</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>作者</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in musicList" :key="item.id">
          <td>{{ item.id }}</td>
          <td>
            <input
              v-model="item.title"
              :name="`title-${item.id}`"
              :aria-label="`音乐 ${item.id} 名称`"
              class="table-input"
              maxlength="100"
            />
          </td>
          <td>
            <input
              v-model="item.artist"
              :name="`artist-${item.id}`"
              :aria-label="`音乐 ${item.id} 作者`"
              class="table-input"
              maxlength="100"
            />
          </td>
          <td>
            <button
              type="button"
              class="save-btn"
              :disabled="savingId === item.id"
              @click="save(item)"
            >
              {{ savingId === item.id ? '保存中...' : '保存' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createAdminMusic, getAdminMusic, updateAdminMusic } from '@/api/admin'
import type { AdminMusic } from '@/api/admin'

const musicList = ref<AdminMusic[]>([])
const loading = ref(false)
const savingId = ref<number | null>(null)
const showCreate = ref(false)
const creating = ref(false)
const emptyDraft = () => ({ title: '', artist: '', url: '', duration: '', category: '', cover: '' })
const draft = ref(emptyDraft())

const load = async () => {
  loading.value = true
  try {
    musicList.value = await getAdminMusic()
  } catch {
    ElMessage.error('获取音乐失败')
  } finally {
    loading.value = false
  }
}

const save = async (item: AdminMusic) => {
  const title = item.title.trim()
  const artist = item.artist?.trim() ?? ''
  if (!title) {
    ElMessage.error('音乐名称不能为空')
    return
  }

  savingId.value = item.id
  try {
    const updated = await updateAdminMusic(item.id, { title, artist })
    Object.assign(item, updated)
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    savingId.value = null
  }
}

const create = async () => {
  creating.value = true
  try {
    await createAdminMusic({ ...draft.value })
    draft.value = emptyDraft()
    showCreate.value = false
    ElMessage.success('音乐添加成功')
    await load()
  } catch {
    ElMessage.error('添加音乐失败')
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.state {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.table th,
.table td {
  border-bottom: 1px solid #f1f5f9;
  padding: 10px;
  text-align: left;
}
.head-actions { display: flex; gap: 8px; }.primary { border: 0; border-radius: 7px; padding: 8px 14px; color: #fff; background: #e8834a; cursor: pointer; }
.create-form { margin-bottom: 18px; padding: 16px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; border: 1px solid #fed7aa; border-radius: 12px; background: #fffaf5; }.form-head { grid-column: 1 / -1; display: flex; justify-content: space-between; }.form-head h3 { margin: 0; }.create-form input { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 7px; }.create-form .primary { justify-self: start; }
@media (max-width: 760px) { .create-form { grid-template-columns: 1fr; }.form-head { grid-column: auto; } }
.table-input {
  width: 100%;
  min-width: 140px;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  color: #1e293b;
  background: #fff;
}
.table-input:focus {
  border-color: #e8834a;
  outline: 2px solid rgba(232, 131, 74, 0.18);
}
.save-btn:disabled {
  cursor: wait;
  opacity: 0.6;
}
</style>
