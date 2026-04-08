<template>
  <div class="admin-page">
    <h2>管理后台</h2>
    <p class="sub">欢迎进入管理后台，请选择要管理的模块。</p>

    <div class="cards">
      <router-link class="card" to="/admin/users">
        <h3>用户管理</h3>
        <p>查看用户并修改角色（仅 super_admin）。</p>
      </router-link>
      <router-link class="card" to="/admin/user-moods">
        <h3>用户情绪数据</h3>
        <p>查看用户情绪记录，支持筛选、分页与导出。</p>
      </router-link>
      <router-link class="card" to="/admin/posts">
        <h3>帖子审核</h3>
        <p>快速审核帖子内容并处理状态。</p>
      </router-link>
      <router-link class="card" to="/admin/courses">
        <h3>课程管理</h3>
        <p>维护课程内容和可见状态。</p>
      </router-link>
      <router-link class="card" to="/admin/music">
        <h3>音乐管理</h3>
        <p>维护音乐疗愈资源信息。</p>
      </router-link>
      <router-link class="card" to="/admin/audit-logs">
        <h3>审计日志</h3>
        <p>查看关键操作日志（仅 super_admin）。</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.sub {
  color: #64748b;
  margin-bottom: 16px;
}

.cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
  color: #0f172a;
  padding: 14px;

  h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: #475569;
    font-size: 14px;
  }
}
</style>
