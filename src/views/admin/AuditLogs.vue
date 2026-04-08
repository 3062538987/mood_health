<template>
  <div class="admin-page">
    <div class="head">
      <h2>审计日志</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="logs.length === 0" class="state">暂无日志</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>操作者</th>
          <th>权限</th>
          <th>操作</th>
          <th>结果</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in logs" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.operatorId ?? '-' }}</td>
          <td>{{ item.permissionCode || '-' }}</td>
          <td>{{ item.operationType || '-' }}</td>
          <td>{{ item.operationResult || '-' }}</td>
          <td>{{ item.operationTime || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminAuditLogs } from '@/api/admin'
import type { AdminAuditLog } from '@/api/admin'

const logs = ref<AdminAuditLog[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    logs.value = await getAdminAuditLogs()
  } catch (error) {
    ElMessage.error('获取审计日志失败')
  } finally {
    loading.value = false
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
  white-space: nowrap;
}
</style>
