<template>
  <div class="login-container">
    <div class="login-box">
      <h2>用户登录</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            required
            :aria-invalid="Boolean(fieldErrors.username)"
            :aria-describedby="fieldErrors.username ? 'username-error' : undefined"
            @blur="validateField('username')"
            @input="handleFieldInput('username')"
          />
          <p v-if="fieldErrors.username" id="username-error" class="field-error">
            {{ fieldErrors.username }}
          </p>
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            required
            :aria-invalid="Boolean(fieldErrors.password)"
            :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
            @blur="validateField('password')"
            @input="handleFieldInput('password')"
          />
          <p v-if="fieldErrors.password" id="password-error" class="field-error">
            {{ fieldErrors.password }}
          </p>
        </div>
        <div v-if="userStore.error" class="error-message">
          {{ userStore.error }}
        </div>
        <button type="submit" :disabled="userStore.loading" class="btn-login">
          {{ userStore.loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <div class="footer">
        <span>还没有账号？</span>
        <router-link to="/register" class="link">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { isValidUsername } from '@/utils/validation'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({
  username: '',
  password: '',
})

type LoginField = keyof typeof form

const fieldErrors = reactive<Record<LoginField, string>>({
  username: '',
  password: '',
})

const loginValidators: Record<LoginField, () => string> = {
  username: () =>
    isValidUsername(form.username)
      ? ''
      : '用户名需为3-20位，可包含中文、字母、数字或下划线',
  password: () => (form.password.length >= 6 ? '' : '密码长度至少6位'),
}

const validateField = (field: LoginField) => {
  fieldErrors[field] = loginValidators[field]()
  return !fieldErrors[field]
}

const handleFieldInput = (field: LoginField) => {
  if (fieldErrors[field] && !loginValidators[field]()) {
    fieldErrors[field] = ''
  }
  userStore.clearError()
}

const validateLoginForm = () => {
  const fields = Object.keys(fieldErrors) as LoginField[]
  const results = fields.map((field) => validateField(field))
  return results.every(Boolean)
}

const getSafeRedirect = () => {
  const redirect = route.query.redirect
  const target = Array.isArray(redirect) ? redirect[0] : redirect

  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return '/'
  }

  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) {
      return '/'
    }
    const safePath = `${url.pathname}${url.search}${url.hash}`
    if (!safePath.startsWith('/') || safePath.startsWith('//')) {
      return '/'
    }
    return safePath
  } catch {
    return '/'
  }
}

const handleLogin = async () => {
  if (userStore.loading) {
    return
  }

  if (!validateLoginForm()) {
    return
  }

  const success = await userStore.login(form.username, form.password)
  if (success) {
    ElMessage.success('登录成功')
    router.push(getSafeRedirect())
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  padding: 20px;
}

.login-box {
  background: var(--surface);
  padding: 40px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 400px;
}

h2 {
  text-align: center;
  color: var(--text-color);
  margin-bottom: 30px;
  font-size: 24px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-color);
  font-weight: 500;
}

input {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  box-sizing: border-box;
  background: var(--surface);
  color: var(--text-color);
}

input:focus {
  outline: none;
  border-color: var(--focus);
  box-shadow: 0 0 0 3px var(--primary-soft-bg);
}

.error-message {
  color: var(--danger);
  font-size: 14px;
  margin-bottom: 15px;
  text-align: center;
}

.field-error {
  color: var(--danger);
  font-size: 13px;
  margin: 6px 0 0;
}

.btn-login {
  width: 100%;
  padding: 14px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--primary-hover);
  box-shadow: 0 5px 20px rgba(106, 176, 165, 0.28);
}

.btn-login:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.footer {
  text-align: center;
  margin-top: 25px;
  color: var(--muted);
  font-size: 14px;
}

.link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
  margin-left: 5px;
}

.link:hover {
  text-decoration: underline;
}
</style>
