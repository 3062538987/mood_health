<template>
  <aside class="session-sidebar" aria-label="历史会话">
    <header class="sidebar-header">
      <h3>历史会话</h3>
      <button class="close-sidebar" type="button" aria-label="关闭历史会话" @click="emit('close')">
        ✕
      </button>
    </header>

    <button class="new-session-btn" type="button" @click="emit('create')">
      + 新建对话
    </button>

    <div class="session-list" aria-live="polite">
      <div v-if="loading" class="session-state">正在加载历史会话...</div>

      <div v-else-if="error" class="session-state session-error" role="alert">
        <span>{{ error }}</span>
        <button type="button" data-action="retry" @click="emit('retry')">重新加载</button>
      </div>

      <div v-else-if="sessions.length === 0" class="session-state">
        暂无历史会话
      </div>

      <div
        v-for="session in sessions"
        v-else
        :key="session.sessionId"
        :data-session-id="session.sessionId"
        :class="['session-item', { active: session.sessionId === currentSessionId }]"
        role="button"
        tabindex="0"
        @click="emit('select', session.sessionId)"
        @keydown.enter.prevent="emit('select', session.sessionId)"
        @keydown.space.prevent="emit('select', session.sessionId)"
      >
        <div
          v-if="editingSessionId === session.sessionId"
          :ref="setRenameEditorRef"
          class="rename-editor"
          @click.stop
          @keydown.stop
        >
          <input
            :ref="setRenameInputRef"
            v-model="renameDraft"
            maxlength="30"
            aria-label="会话标题"
            @keydown.enter.prevent="submitRename"
            @keydown.esc.prevent="cancelRename"
          />
          <div class="rename-actions">
            <button type="button" aria-label="保存会话名称" @click="submitRename">✓</button>
            <button type="button" aria-label="取消重命名" @click="cancelRename">✕</button>
          </div>
          <p v-if="renameError" class="rename-error" role="alert">{{ renameError }}</p>
        </div>

        <template v-else>
          <div class="session-copy">
            <div class="session-title" :title="session.title">{{ session.title }}</div>
            <div class="session-meta">
              {{ formatDate(session.lastMessageAt) }} · {{ session.messageCount }} 条消息
            </div>
          </div>

          <div class="session-menu-wrap" @click.stop>
            <button
              class="session-menu-button"
              type="button"
              aria-label="会话操作"
              :aria-expanded="menuSessionId === session.sessionId"
              @click="toggleMenu(session.sessionId)"
            >
              …
            </button>
            <div v-if="menuSessionId === session.sessionId" class="session-menu">
              <button type="button" data-action="rename" @click="startRename(session)">
                重命名
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { SessionItem } from '@/api/counseling'

defineProps<{
  sessions: SessionItem[]
  currentSessionId: string
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  create: []
  retry: []
  select: [sessionId: string]
  rename: [payload: { sessionId: string; title: string }]
}>()

const menuSessionId = ref('')
const editingSessionId = ref('')
const renameDraft = ref('')
const renameError = ref('')
const renameEditorRef = ref<HTMLElement | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)

const setRenameEditorRef = (element: unknown) => {
  renameEditorRef.value = element instanceof HTMLElement ? element : null
}

const setRenameInputRef = (element: unknown) => {
  renameInputRef.value = element instanceof HTMLInputElement ? element : null
}

const toggleMenu = (sessionId: string) => {
  menuSessionId.value = menuSessionId.value === sessionId ? '' : sessionId
}

const startRename = async (session: SessionItem) => {
  menuSessionId.value = ''
  editingSessionId.value = session.sessionId
  renameDraft.value = session.title
  renameError.value = ''
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

const cancelRename = () => {
  editingSessionId.value = ''
  renameDraft.value = ''
  renameError.value = ''
}

const submitRename = () => {
  const title = renameDraft.value.trim()
  if (title.length < 1 || title.length > 30) {
    renameError.value = '标题长度为1到30个字符'
    return
  }

  emit('rename', { sessionId: editingSessionId.value, title })
  cancelRename()
}

onClickOutside(renameEditorRef, () => {
  if (editingSessionId.value) {
    cancelRename()
  }
})

const formatDate = (isoTime: string): string => {
  if (!isoTime) return ''
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
</script>

<style scoped lang="scss">
.session-sidebar {
  width: 300px;
  max-width: 86vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-color);
  background: var(--surface);
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);

  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.close-sidebar,
.session-menu-button {
  border: 0;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.close-sidebar {
  padding: 4px 8px;
  border-radius: 6px;

  &:hover {
    color: var(--text-color);
    background: var(--surface-muted);
  }
}

.new-session-btn {
  margin: 12px 16px;
  padding: 10px 16px;
  border: 1px dashed var(--primary-color);
  border-radius: 10px;
  color: var(--primary-color);
  background: var(--primary-soft-bg);
  cursor: pointer;

  &:hover {
    color: #fff;
    background: var(--primary-color);
    border-style: solid;
  }
}

.session-list {
  flex: 1;
  padding: 0 8px 12px;
  overflow-y: auto;
}

.session-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 16px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.session-error button {
  padding: 6px 12px;
  border: 1px solid var(--primary-color);
  border-radius: 8px;
  color: var(--primary-color);
  background: transparent;
  cursor: pointer;
}

.session-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 62px;
  margin: 4px 0;
  padding: 10px 8px 10px 12px;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  border-radius: 10px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--surface-muted);
    border-color: var(--border-color);
    outline: none;
  }

  &.active {
    background: var(--primary-soft-bg);
    border-left-color: var(--primary-color);
  }
}

.session-copy {
  min-width: 0;
  flex: 1;
}

.session-title {
  overflow: hidden;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
}

.session-menu-wrap {
  position: relative;
}

.session-menu-button {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  font-size: 18px;

  &:hover,
  &[aria-expanded='true'] {
    color: var(--text-color);
    background: var(--surface);
  }
}

.session-menu {
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 2;
  min-width: 96px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-md);

  button {
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: 6px;
    color: var(--text-color);
    background: transparent;
    cursor: pointer;
    text-align: left;

    &:hover {
      background: var(--surface-muted);
    }
  }
}

.rename-editor {
  width: 100%;
}

.rename-editor input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid var(--primary-color);
  border-radius: 7px;
  color: var(--text-color);
  background: var(--surface);
  outline: none;
}

.rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;

  button {
    width: 28px;
    height: 26px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-color);
    background: var(--surface);
    cursor: pointer;
  }
}

.rename-error {
  margin: 5px 0 0;
  color: var(--danger-color, #d14343);
  font-size: 12px;
}

@media (max-width: 640px) {
  .session-sidebar {
    width: min(86vw, 340px);
  }
}
</style>
