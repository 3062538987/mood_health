<template>
  <div class="module-layout">
    <!-- 二级导航 -->
    <SubNav :items="subNavItems" />
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SubNav from '@/components/shared/SubNav.vue'

const route = useRoute()
const subNavItems = computed(() => {
  const items = route.meta.subNav
  if (!Array.isArray(items)) {
    return []
  }

  return items.filter((item) => item.path !== '/mood/analysis')
})
</script>
