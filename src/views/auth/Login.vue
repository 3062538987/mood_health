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
          <div class="input-wrapper">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              required
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
              @blur="validateField('password')"
              @input="handleFieldInput('password')"
            />
            <button
              type="button"
              class="toggle-password"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
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
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { isValidUsername } from '@/utils/validation'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const showPassword = ref(false)

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

onMounted(() => {
  const username = route.query.username as string
  if (username && isValidUsername(username)) {
    form.username = username
  }
})

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
  padding: 20px;
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(240, 184, 96, 0.15) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(232, 131, 74, 0.06) 0%, transparent 50%),
    var(--bg-color);
}

.login-box {
  background: var(--surface);
  padding: 44px 40px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 420px;
  animation: fadeInUp 0.5s ease both;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

h2 {
  text-align: center;
  color: var(--text-color);
  margin-bottom: 8px;
  font-size: 28px;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-color);
  font-weight: 600;
  font-size: 14px;
}

.input-wrapper {
  position: relative;
}

input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 15px;
  transition: all 0.25s ease;
  box-sizing: border-box;
  background: var(--surface-muted);
  color: var(--text-color);
  font-family: var(--font-body);
}

input::placeholder { color: var(--text-muted); }

input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px var(--focus-ring);
  background: var(--surface);
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s;
  font-size: 16px;

  &:hover {
    color: var(--primary-color);
    background: var(--primary-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
}

.error-message {
  color: var(--danger-color);
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
  padding: 10px;
  background: rgba(224, 85, 106, 0.08);
  border-radius: var(--radius-md);
}

.field-error {
  color: var(--danger-color);
  font-size: 13px;
  margin: 6px 0 0;
}

.btn-login {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(232, 131, 74, 0.25);
  letter-spacing: 0.02em;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(232, 131, 74, 0.35);
}

.btn-login:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.footer {
  text-align: center;
  margin-top: 28px;
  color: var(--text-muted);
  font-size: 14px;
}

.link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 700;
  margin-left: 4px;
  transition: color 0.2s;
}

.link:hover { color: var(--primary-hover); text-decoration: underline; }
</style>
