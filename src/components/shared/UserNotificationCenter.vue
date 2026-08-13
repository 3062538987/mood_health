<template>
  <div class="sr-only" aria-live="polite">{{ latestAnnouncement }}</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch, ref } from 'vue'
import { ElNotification } from 'element-plus'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { listNotifications, markNotificationRead } from '@/api/notifications'

const POLL_INTERVAL_MS = 60_000
const userStore = useUserStore()
const router = useRouter()
const shownIds = new Set<number>()
const latestAnnouncement = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollAbortController: AbortController | null = null

const poll = async () => {
  if (!userStore.isLoggedIn || userStore.logoutInProgress) return
  const controller = new AbortController()
  pollAbortController?.abort()
  pollAbortController = controller
  try {
    const notifications = await listNotifications(controller.signal)
    if (controller.signal.aborted || !userStore.isLoggedIn || userStore.logoutInProgress) return
    if (!Array.isArray(notifications)) return
    for (const notification of notifications.slice().reverse()) {
      if (notification.readAt || shownIds.has(notification.id)) continue
      shownIds.add(notification.id)
      latestAnnouncement.value = `${notification.title}：${notification.message}`
      ElNotification({
        title: notification.title,
        message: notification.message,
        type: notification.notificationType === 'weekly_report' ? 'success' : 'info',
        duration: 8000,
        onClick: () => {
          if (notification.actionPath?.startsWith('/')) {
            void router.push(notification.actionPath)
          }
        },
      })
      await markNotificationRead(notification.id)
    }
  } catch (error) {
    if (controller.signal.aborted || !userStore.isLoggedIn || userStore.logoutInProgress) return
    console.error('通知轮询失败', error)
  } finally {
    if (pollAbortController === controller) pollAbortController = null
  }
}

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  pollAbortController?.abort()
  pollAbortController = null
}

const startPolling = () => {
  stopPolling()
  void poll()
  pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
}

watch(
  () => [userStore.isLoggedIn, userStore.logoutInProgress] as const,
  ([loggedIn, loggingOut]) => {
    if (loggedIn && !loggingOut) startPolling()
    else {
      stopPolling()
      shownIds.clear()
    }
  },
  { immediate: true }
)

onBeforeUnmount(stopPolling)
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
