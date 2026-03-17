<template>
  <div v-if="items && items.length" class="sub-nav-container">
    <nav class="sub-nav">
      <router-link v-for="item in items" :key="item.path" :to="item.path" active-class="active">
        <i :class="item.icon"></i> {{ item.name }}
      </router-link>
    </nav>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped lang="scss">
.sub-nav-container {
  background: #f8faf9;
  border-bottom: 1px solid #e0e6e3;
  padding: 0.5rem 0;
}

.sub-nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  gap: 2rem;

  a {
    color: #5a6b60;
    text-decoration: none;
    padding: 0.3rem 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;

    &:hover {
      color: #6b9080;
      border-bottom-color: #6b9080;
    }

    &.active {
      color: #6b9080;
      border-bottom-color: #6b9080;
      font-weight: 600;
    }
  }
}
</style>
