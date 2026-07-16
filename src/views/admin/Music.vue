<template>
  <div class="admin-page">
    <div class="head">
      <h2>音乐管理</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="musicList.length === 0" class="state">暂无音乐</div>

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
          <td>{{ item.title }}</td>
          <td>{{ item.artist || '-' }}</td>
          <td>
            <button @click="touch(item.id)">保存</button>
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

const load = async () => {
  loading.value = true
  try {
    musicList.value = await getAdminMusic()
  } catch (error) {
    ElMessage.error('获取音乐失败')
  } finally {
    loading.value = false
  }
}

const touch = async (id: number) => {
  try {
    await updateAdminMusic(id, {})
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
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
</style>
