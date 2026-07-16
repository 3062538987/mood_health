<template>
  <div class="admin-page">
    <div class="head">
      <h2>帖子审核</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="posts.length === 0" class="state">暂无数据</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>标题</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in posts" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.title || '未命名' }}</td>
          <td>{{ item.status }}</td>
          <td>
            <button @click="updateStatus(item.id, 1)">通过</button>
            <button @click="updateStatus(item.id, 2)">拒绝</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminPosts, updateAdminPost } from '@/api/admin'
import type { AdminPost } from '@/api/admin'

const posts = ref<AdminPost[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    posts.value = await getAdminPosts()
  } catch (error) {
    ElMessage.error('获取帖子失败')
  } finally {
    loading.value = false
  }
}

const updateStatus = async (id: number, status: number) => {
  try {
    await updateAdminPost(id, { status })
    ElMessage.success('操作成功')
    await load()
  } catch (error) {
    ElMessage.error('操作失败')
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
