<template>
  <div class="admin-page">
    <div class="head">
      <h2>课程管理</h2>
      <div class="actions">
        <button :disabled="loading" @click="openCreate">+ 新建课程</button>
        <button :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="courses.length === 0" class="state">暂无课程</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>标题</th>
          <th>分类</th>
          <th>类型</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in courses" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.title }}</td>
          <td>{{ item.category || '-' }}</td>
          <td>{{ item.type || '-' }}</td>
          <td>
            <button @click="openEdit(item)">编辑</button>
            <button class="danger" @click="remove(item.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <h3>{{ editId ? '编辑课程' : '新建课程' }}</h3>

        <div class="form-grid">
          <label>
            标题
            <input v-model.trim="form.title" type="text" placeholder="请输入课程标题" />
          </label>
          <label>
            分类
            <input v-model.trim="form.category" type="text" placeholder="如：情绪管理" />
          </label>
          <label class="span-2">
            描述
            <textarea v-model.trim="form.description" rows="2" placeholder="课程简介"></textarea>
          </label>
          <label class="span-2">
            视频链接（可选）
            <input
              v-model.trim="form.videoUrl"
              type="url"
              placeholder="https://example.com/video.mp4"
            />
          </label>
          <label class="span-2">
            封面图链接（可选）
            <input
              v-model.trim="form.coverImage"
              type="url"
              placeholder="https://example.com/cover.jpg"
            />
          </label>
          <label class="span-2">
            正文内容（可选）
            <textarea
              v-model.trim="form.content"
              rows="4"
              placeholder="文章型课程可填写正文"
            ></textarea>
          </label>
        </div>

        <div class="modal-actions">
          <button @click="closeModal">取消</button>
          <button :disabled="submitting" @click="submitForm">
            {{ submitting ? '提交中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createAdminCourse,
  deleteAdminCourse,
  getAdminCourses,
  updateAdminCourse,
} from '@/api/admin'
import type { AdminCourse, AdminCoursePayload } from '@/api/admin'

const courses = ref<AdminCourse[]>([])
const loading = ref(false)
const submitting = ref(false)
const showModal = ref(false)
const editId = ref<number | null>(null)
const form = reactive<AdminCoursePayload>({
  title: '',
  description: '',
  content: '',
  videoUrl: '',
  coverImage: '',
  category: '',
})

const load = async () => {
  loading.value = true
  try {
    courses.value = await getAdminCourses()
  } catch (error) {
    ElMessage.error('获取课程失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.title = ''
  form.description = ''
  form.content = ''
  form.videoUrl = ''
  form.coverImage = ''
  form.category = ''
}

const openCreate = () => {
  editId.value = null
  resetForm()
  showModal.value = true
}

const openEdit = (item: AdminCourse) => {
  editId.value = item.id
  form.title = item.title || ''
  form.description = item.description || ''
  form.content = item.content || ''
  form.category = item.category || ''
  form.coverImage = item.coverUrl || ''
  form.videoUrl = item.type === 'video' ? item.content || '' : ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  resetForm()
  editId.value = null
}

const submitForm = async () => {
  if (!form.title || !form.description || !form.category) {
    ElMessage.warning('请填写标题、描述、分类')
    return
  }

  const payload: AdminCoursePayload = {
    title: form.title,
    description: form.description,
    category: form.category,
    content: form.content,
    videoUrl: form.videoUrl,
    coverImage: form.coverImage,
  }

  submitting.value = true
  try {
    if (editId.value) {
      await updateAdminCourse(editId.value, payload)
      ElMessage.success('课程更新成功')
    } else {
      await createAdminCourse(payload)
      ElMessage.success('课程创建成功')
    }

    closeModal()
    await load()
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

const remove = async (id: number) => {
  if (!window.confirm('确认删除该课程吗？')) {
    return
  }

  try {
    await deleteAdminCourse(id)
    ElMessage.success('删除成功')
    await load()
  } catch (error) {
    ElMessage.error('删除失败')
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
  align-items: center;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 8px;
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

.danger {
  margin-left: 8px;
  color: #dc2626;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  z-index: 3000;
}

.modal {
  width: min(760px, calc(100vw - 32px));
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.span-2 {
  grid-column: span 2;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}

input,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

.modal-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
