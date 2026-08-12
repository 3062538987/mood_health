<template>
  <section class="upload-card" aria-labelledby="upload-title-heading">
    <div class="upload-heading">
      <div>
        <p class="eyebrow">共享新资料</p>
        <h3 id="upload-title-heading">上传老师自备资料</h3>
      </div>
      <span class="limit">PDF / DOCX / TXT · 最大 10MB</span>
    </div>

    <form @submit.prevent="submit">
      <label>
        <span>资料标题</span>
        <input
          v-model.trim="title"
          data-test="upload-title"
          maxlength="200"
          placeholder="例如：压力管理课堂练习"
          required
        />
      </label>
      <label class="summary-field">
        <span>资料简介</span>
        <textarea
          v-model.trim="summary"
          data-test="upload-summary"
          maxlength="2000"
          rows="3"
          placeholder="说明资料内容、适用对象和使用方式"
          required
        ></textarea>
      </label>
      <label>
        <span>授权说明（可选）</span>
        <input v-model.trim="licenseCode" maxlength="80" placeholder="例如：校内教学使用" />
      </label>
      <label class="file-field">
        <span>选择文件</span>
        <input
          :key="fileInputKey"
          data-test="upload-file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          @change="selectFile"
        />
        <small>{{ selectedFile?.name || '尚未选择文件' }}</small>
      </label>
      <button type="submit" :disabled="submitting">
        {{ submitting ? '正在上传…' : '上传并共享' }}
      </button>
    </form>

    <p v-if="error" role="alert" class="message error-message">{{ error }}</p>
    <p v-else-if="success" role="status" class="message success-message">{{ success }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  uploadKnowledgeResource,
  type KnowledgeResource,
} from '@/api/knowledgeResources'
import { getErrorMessage } from '@/utils/request'

const emit = defineEmits<{ uploaded: [resource: KnowledgeResource] }>()

const title = ref('')
const summary = ref('')
const licenseCode = ref('')
const selectedFile = ref<File | null>(null)
const fileInputKey = ref(0)
const submitting = ref(false)
const error = ref('')
const success = ref('')

const selectFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
  error.value = ''
  success.value = ''
}

const submit = async () => {
  error.value = ''
  success.value = ''
  if (!selectedFile.value) {
    error.value = '请选择 PDF、DOCX 或 TXT 文件'
    return
  }
  if (selectedFile.value.size > 10 * 1024 * 1024) {
    error.value = '文件大小不能超过 10MB'
    return
  }

  submitting.value = true
  try {
    const resource = await uploadKnowledgeResource({
      title: title.value,
      summary: summary.value,
      licenseCode: licenseCode.value || undefined,
      file: selectedFile.value,
    })
    success.value = '资料上传成功，已加入共享资料目录'
    title.value = ''
    summary.value = ''
    licenseCode.value = ''
    selectedFile.value = null
    fileInputKey.value += 1
    emit('uploaded', resource)
  } catch (uploadError) {
    error.value = getErrorMessage(uploadError, '资料上传失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.upload-card { padding: 22px; border: 1px solid #dfe9e4; border-radius: 18px; background: #fff; }
.upload-heading { margin-bottom: 18px; display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.eyebrow { margin: 0 0 4px; color: #398069; font-size: 12px; font-weight: 700; letter-spacing: .12em; }.upload-heading h3 { margin: 0; font-size: 20px; }.limit { padding: 6px 10px; border-radius: 99px; color: #567068; background: #edf5f1; font-size: 12px; }
form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }label span { margin-bottom: 6px; display: block; color: #40564e; font-size: 13px; font-weight: 700; }input, textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d5e0db; border-radius: 10px; color: #263b33; background: #fff; font: inherit; }input:focus, textarea:focus { border-color: #4b987d; outline: 3px solid rgba(75,152,125,.12); }.summary-field { grid-column: 1 / -1; }.file-field small { margin-top: 6px; display: block; color: #7b8c85; }form button { align-self: end; min-height: 42px; border: 0; border-radius: 10px; color: #fff; background: #33785f; font-weight: 700; cursor: pointer; }form button:disabled { opacity: .58; cursor: wait; }.message { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; }.error-message { color: #9b3636; background: #fff0f0; }.success-message { color: #216448; background: #eaf7f0; }
@media (max-width: 680px) { .upload-heading { flex-direction: column; }form { grid-template-columns: 1fr; }.summary-field { grid-column: auto; } }
</style>
