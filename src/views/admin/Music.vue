<template>
  <div class="admin-page">
    <div class="head">
      <h2>音乐管理</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>

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
import { getAdminMusic, updateAdminMusic } from '@/api/admin'
import type { AdminMusic } from '@/api/admin'

const musicList = ref<AdminMusic[]>([])
const loading = ref(false)
const savingId = ref<number | null>(null)

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
