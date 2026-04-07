<template>
  <div class="admin-users-page">
    <div class="page-header">
      <h2>用户权限管理</h2>
      <button class="refresh-btn" :disabled="loading" @click="loadUsers">刷新</button>
    </div>

    <div v-if="!isSuperAdmin" class="state-block">仅 super_admin 可修改用户角色。</div>

    <div v-if="loading" class="state-block">加载中...</div>
    <div v-else-if="users.length === 0" class="state-block">暂无用户数据</div>

    <div v-else class="table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in users" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ item.username }}</td>
            <td>{{ item.email }}</td>
            <td>
              <select
                class="role-select"
                :disabled="!isSuperAdmin"
                :value="getPendingRole(item.id, item.role)"
                @change="onRoleChange(item.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </td>
            <td>{{ formatDate(item.createdAt) }}</td>
            <td>
              <div class="action-group">
                <button
                  class="save-btn"
                  :disabled="!isSuperAdmin || !hasRoleChanged(item) || savingUserId === item.id"
                  @click="saveRole(item)"
                >
                  {{ savingUserId === item.id ? '保存中...' : '保存' }}
                </button>
                <button
                  class="delete-btn"
                  :disabled="
                    !isSuperAdmin ||
                    deletingUserId === item.id ||
                    item.id === currentUserId ||
                    item.role === 'super_admin'
                  "
                  @click="deleteUser(item)"
                >
                  {{ deletingUserId === item.id ? '删除中...' : '删除' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteAdminUser, getAdminUsers, updateAdminUserRole } from '@/api/admin'
import type { AdminUser, UserRole } from '@/api/admin'
import { useUserStore } from '@/stores/userStore'

const users = ref<AdminUser[]>([])
const loading = ref(false)
const savingUserId = ref<number | null>(null)
const deletingUserId = ref<number | null>(null)
const pendingRoles = ref<Record<number, UserRole>>({})
const userStore = useUserStore()
const isSuperAdmin = computed(() => userStore.user?.role === 'super_admin')
const currentUserId = computed(() => userStore.user?.id ?? null)

const loadUsers = async () => {
  loading.value = true
  try {
    const list = await getAdminUsers()
    users.value = list

    const nextPending: Record<number, UserRole> = {}
    for (const item of list) {
      nextPending[item.id] = item.role
    }
    pendingRoles.value = nextPending
  } catch (error) {
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const getPendingRole = (userId: number, fallbackRole: UserRole) => {
  return pendingRoles.value[userId] || fallbackRole
}

const onRoleChange = (userId: number, role: string) => {
  if (role === 'user' || role === 'admin' || role === 'super_admin') {
    pendingRoles.value[userId] = role
  }
}

const hasRoleChanged = (item: AdminUser) => {
  return getPendingRole(item.id, item.role) !== item.role
}

const saveRole = async (item: AdminUser) => {
  if (!isSuperAdmin.value) {
    ElMessage.warning('仅 super_admin 可修改角色')
    return
  }

  const nextRole = getPendingRole(item.id, item.role)
  if (nextRole === item.role) {
    return
  }

  savingUserId.value = item.id
  try {
    await updateAdminUserRole(item.id, nextRole)
    item.role = nextRole
    ElMessage.success('角色更新成功')
  } catch (error) {
    ElMessage.error('角色更新失败')
  } finally {
    savingUserId.value = null
  }
}

const deleteUser = async (item: AdminUser) => {
  if (!isSuperAdmin.value) {
    ElMessage.warning('仅 super_admin 可删除用户')
    return
  }

  if (item.id === currentUserId.value) {
    ElMessage.warning('不能删除当前登录用户')
    return
  }

  if (item.role === 'super_admin') {
    ElMessage.warning('不能删除超级管理员')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除用户「${item.username}」吗？此操作会删除其关联的情绪、帖子、评论等数据，且不可恢复。`,
      '删除用户',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'admin-delete-confirm-btn',
      }
    )
  } catch {
    return
  }

  deletingUserId.value = item.id
  try {
    await deleteAdminUser(item.id)
    ElMessage.success('用户删除成功')
    await loadUsers()
  } catch (error) {
    ElMessage.error('删除用户失败')
  } finally {
    deletingUserId.value = null
  }
}

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

onMounted(loadUsers)
</script>

<style scoped lang="scss">
.admin-users-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.refresh-btn,
.save-btn,
.delete-btn {
  border: 1px solid #2f6fed;
  color: #2f6fed;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.delete-btn {
  border-color: #ef4444;
  color: #ef4444;
}

.refresh-btn:disabled,
.save-btn:disabled,
.delete-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.action-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.state-block {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  color: #4b5563;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.users-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    padding: 10px 12px;
    white-space: nowrap;
  }

  thead th {
    background: #f8fafc;
    font-weight: 600;
  }
}

.role-select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 4px 8px;
  min-width: 140px;
}
</style>
