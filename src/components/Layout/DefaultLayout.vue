<template>
  <div class="layout">
    <nav class="layout-nav">
      <router-link to="/">首页</router-link>
      <router-link to="/mood/record">情绪记录</router-link>
      <router-link to="/relax/center">解压中心</router-link>
      <router-link to="/improve/group">团体辅导</router-link>
      <router-link to="/user/profile">个人中心</router-link>
    </nav>
    <nav class="layout-mobile-tabs" aria-label="移动端主导航">
      <router-link to="/" class="tab-item" active-class="active" end>
        <i class="fas fa-home"></i>
        <span>首页</span>
      </router-link>
      <router-link to="/mood/record" class="tab-item" active-class="active">
        <i class="fas fa-smile"></i>
        <span>情绪</span>
      </router-link>
      <router-link to="/user/profile" class="tab-item" active-class="active">
        <i class="fas fa-user"></i>
        <span>我的</span>
      </router-link>
      <router-link v-if="isAdmin" to="/admin" class="tab-item" active-class="active">
        <i class="fas fa-user-shield"></i>
        <span>后台</span>
      </router-link>
    </nav>
    <router-view />
  </div>
</template>

<style scoped lang="scss">
.layout-nav {
  display: flex;
  gap: 20px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  a {
    text-decoration: none;
    color: #333;
    &.router-link-exact-active {
      color: #42b983;
    }
  }
}

.layout-mobile-tabs {
  display: none;
}

@media (max-width: 768px) {
  .layout-nav {
    display: none;
  }

  .layout-mobile-tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px;
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 120;
    padding: 10px 12px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.8);

    .tab-item {
      min-height: 44px;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 4px;
      color: #64748b;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;

      i {
        font-size: 18px;
        color: #42b983;
      }

      &.active {
        color: #42b983;
      }
    }
  }
}
</style>
