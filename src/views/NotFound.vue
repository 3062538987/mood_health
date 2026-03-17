<template>
  <section class="not-found">
    <div class="content">
      <p class="code">404</p>
      <h1>页面不存在</h1>
      <p class="description">
        你访问的页面路径无效，可能是地址输入错误，或者该页面已经被移动。
      </p>
      <div class="actions">
        <router-link to="/" class="primary-action">返回首页</router-link>
        <button type="button" class="secondary-action" @click="$router.back()">
          返回上一页
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.not-found {
  min-height: calc(100vh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top, rgba(167, 199, 231, 0.25), transparent 45%),
    linear-gradient(180deg, #f7fbff 0%, #eef4f8 100%);
}

.content {
  width: min(560px, 100%);
  padding: 3rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(167, 199, 231, 0.4);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(86, 119, 153, 0.15);
}

.code {
  margin: 0;
  font-size: 4rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #6a8caf;
}

h1 {
  margin: 1rem 0;
  font-size: 2rem;
  color: #2f4356;
}

.description {
  margin: 0 auto;
  max-width: 28rem;
  line-height: 1.7;
  color: #607588;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.primary-action,
.secondary-action {
  min-width: 140px;
  padding: 0.85rem 1.4rem;
  border-radius: 999px;
  border: none;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.primary-action {
  color: #fff;
  background: linear-gradient(135deg, #6a8caf, #8fb7d9);
  box-shadow: 0 10px 24px rgba(106, 140, 175, 0.25);
}

.secondary-action {
  color: #4f6477;
  background: #fff;
  border: 1px solid rgba(106, 140, 175, 0.35);
}

.primary-action:hover,
.secondary-action:hover {
  transform: translateY(-2px);
}

@media (max-width: 640px) {
  .content {
    padding: 2rem 1.5rem;
  }

  .code {
    font-size: 3rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  .actions {
    flex-direction: column;
  }

  .primary-action,
  .secondary-action {
    width: 100%;
  }
}
</style>
