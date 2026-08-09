<template>
  <div class="register-container">
    <div class="register-box" role="form" aria-label="用户注册表单">
      <h2>用户注册</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            required
            autocomplete="username"
            :aria-invalid="Boolean(fieldErrors.username)"
            :aria-describedby="fieldErrors.username ? 'username-error' : undefined"
            @blur="validateField('username')"
            @input="handleFieldInput('username')"
            @keydown.enter="focusPassword"
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
              ref="passwordInput"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码（6-128位）"
              required
              minlength="6"
              maxlength="128"
              autocomplete="new-password"
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
              @blur="validateField('password')"
              @input="handleFieldInput('password')"
              @keydown.enter="focusConfirmPassword"
            />
            <button
              type="button"
              class="toggle-password"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
              @keydown.enter="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
          <p v-if="fieldErrors.password" id="password-error" class="field-error">
            {{ fieldErrors.password }}
          </p>
          <div v-if="form.password && !fieldErrors.password" class="password-strength" role="status">
            <div class="strength-label">密码强度：{{ passwordStrengthText }}</div>
            <div class="strength-bar">
              <div
                v-for="level in 3"
                :key="level"
                class="strength-segment"
                :class="[`strength-${passwordStrength}`, { active: level <= strengthLevel }]"
                :aria-hidden="true"
              ></div>
            </div>
            <div v-if="passwordStrength === 'weak'" class="strength-hint">
              <i class="fas fa-lightbulb"></i>
              <span>建议使用字母、数字和特殊字符组合</span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            ref="confirmPasswordInput"
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
            autocomplete="new-password"
            :aria-invalid="Boolean(fieldErrors.confirmPassword)"
            :aria-describedby="fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined"
            @blur="validateField('confirmPassword')"
            @input="handleFieldInput('confirmPassword')"
            @keydown.enter="focusEmail"
          />
          <p
            v-if="fieldErrors.confirmPassword"
            id="confirmPassword-error"
            class="field-error"
          >
            {{ fieldErrors.confirmPassword }}
          </p>
        </div>
        <div class="form-group">
          <label for="email">QQ邮箱</label>
          <input
            id="email"
            v-model="form.email"
            type="text"
            placeholder="请输入QQ邮箱（如：123456789@qq.com）"
            required
            autocomplete="email"
            :aria-invalid="Boolean(fieldErrors.email)"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            @blur="validateField('email')"
            @input="handleFieldInput('email')"
            @keydown.enter="handleRegister"
          />
          <p v-if="fieldErrors.email" id="email-error" class="field-error">
            {{ fieldErrors.email }}
          </p>
        </div>
        <div v-if="displayError" class="error-message form-error-message" role="alert" aria-live="polite">
          {{ displayError }}
        </div>
        <button type="submit" :disabled="userStore.loading" class="btn-register" id="register-button">
          {{ userStore.loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <div class="footer">
        <span>已有账号？</span>
        <router-link to="/login" class="link">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { getPasswordStrength, isValidUsername } from '@/utils/validation'

const router = useRouter()
const userStore = useUserStore()
const error = ref('')
const displayError = computed(() => error.value || userStore.error)
const showPassword = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)
const confirmPasswordInput = ref<HTMLInputElement | null>(null)

const focusPassword = () => {
  passwordInput.value?.focus()
}

const focusConfirmPassword = () => {
  confirmPasswordInput.value?.focus()
}

const focusEmail = () => {
  const emailInput = document.getElementById('email') as HTMLInputElement
  emailInput?.focus()
}

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
})

const passwordStrength = computed(() => getPasswordStrength(form.password))

const passwordStrengthText = computed(() => {
  const map = { weak: '弱', medium: '中', strong: '强' }
  return map[passwordStrength.value]
})

const strengthLevel = computed(() => {
  const map = { weak: 1, medium: 2, strong: 3 }
  return map[passwordStrength.value]
})

const qqEmailPattern = /^[a-zA-Z0-9._%+-]+@qq\.com$/
type RegisterField = keyof typeof form

const fieldErrors = reactive<Record<RegisterField, string>>({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
})

const registerValidators: Record<RegisterField, () => string> = {
  username: () =>
    isValidUsername(form.username)
      ? ''
      : '用户名需为3-20位，可包含中文、字母、数字或下划线',
  password: () => {
    if (form.password.length < 6) return '密码长度至少6位'
    if (form.password.length > 128) return '密码长度不能超过128位'
    return ''
  },
  confirmPassword: () =>
    form.password === form.confirmPassword ? '' : '两次输入的密码不一致',
  email: () => {
    const email = form.email.trim()
    if (!email) {
      return 'QQ邮箱不能为空'
    }
    return qqEmailPattern.test(email) ? '' : '请输入正确的QQ邮箱（例如：123456789@qq.com）'
  },
}

const clearFeedback = () => {
  error.value = ''
  userStore.clearError()
}

const validateField = (field: RegisterField) => {
  fieldErrors[field] = registerValidators[field]()
  return !fieldErrors[field]
}

const handleFieldInput = (field: RegisterField) => {
  clearFeedback()
  if (fieldErrors[field] && !registerValidators[field]()) {
    fieldErrors[field] = ''
  }
  if (field === 'password' && fieldErrors.confirmPassword && !registerValidators.confirmPassword()) {
    fieldErrors.confirmPassword = ''
  }
}

const validateRegisterForm = () => {
  const fields = Object.keys(fieldErrors) as RegisterField[]
  const results = fields.map((field) => validateField(field))
  return results.every(Boolean)
}

const handleRegister = async () => {
  clearFeedback()

  if (!validateRegisterForm()) {
    return
  }

  const email = form.email.trim()
  const success = await userStore.register(form.username, form.password, email)

  if (success) {
    ElMessage.success('注册成功！')
    router.push('/guide')
  }
}
</script>

<style scoped>
.register-container {
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

.register-box {
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
  margin-bottom: 28px;
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
  outline: 3px solid var(--focus);
  outline-offset: 2px;
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

.password-strength {
  margin-top: 8px;
}

.strength-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.strength-bar {
  display: flex;
  gap: 4px;
  height: 6px;
}

.strength-segment {
  flex: 1;
  border-radius: 3px;
  background: var(--border-color);
  transition: all 0.25s ease;

  &.active {
    &.strength-weak { background: var(--danger-color); }
    &.strength-medium { background: var(--warning-color); }
    &.strength-strong { background: var(--success-color); }
  }
}

.strength-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--warning-color);
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

.btn-register {
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

.btn-register:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(232, 131, 74, 0.35);
}

.btn-register:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.btn-register:disabled {
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

@media (max-width: 640px) {
  .register-container {
    padding: 16px;
    align-items: flex-start;
    padding-top: 80px;
  }

  .register-box {
    padding: 32px 24px;
    max-width: 100%;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
  }

  h2 {
    font-size: 24px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 18px;
  }

  label {
    font-size: 13px;
    margin-bottom: 6px;
  }

  input {
    padding: 12px 14px;
    font-size: 14px;
  }

  .btn-register {
    padding: 13px;
    font-size: 15px;
  }

  .footer {
    margin-top: 24px;
    font-size: 13px;
  }

  .error-message {
    padding: 8px 10px;
    font-size: 13px;
  }

  .password-strength {
    margin-top: 6px;
  }

  .strength-label {
    font-size: 12px;
  }

  .strength-hint {
    font-size: 11px;
  }
}

@media (max-width: 380px) {
  .register-container {
    padding-top: 60px;
  }

  .register-box {
    padding: 24px 16px;
  }

  h2 {
    font-size: 22px;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  input {
    padding: 11px 12px;
    font-size: 14px;
  }

  .btn-register {
    padding: 12px;
    font-size: 14px;
  }
}
</style>
