<template>
  <div class="module-layout">
    <!-- 二级导航 -->
    <SubNav :items="subNavItems" />
    <router-view />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import SubNav from '@/components/shared/SubNav.vue'

const route = useRoute()
const subNavItems = route.meta.subNav
</script>
