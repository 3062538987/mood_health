<template>
  <div class="module-layout">
    <!-- 二级导航 -->
    <SubNav :items="subNavItems" />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { RouteMeta } from 'vue-router'
import SubNav from '@/components/shared/SubNav.vue'

type SubNavItem = NonNullable<RouteMeta['subNav']>[number]

const route = useRoute()
const subNavItems = computed<SubNavItem[]>(() =>
  (route.meta.subNav ?? []).filter((item) => item.path !== '/mood/analysis')
)
</script>
