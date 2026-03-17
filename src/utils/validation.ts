/**
 * 表单校验工具函数模块
 * 提供常用的表单数据验证功能，包括邮箱、手机号、密码强度等
 */

/**
 * 邮箱校验
 * 验证邮箱地址格式是否正确
 * @param email - 邮箱地址
 * @returns 是否有效，true表示有效，false表示无效
 * @example
 * isValidEmail("test@example.com"); // 返回 true
 * isValidEmail("invalid-email"); // 返回 false
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 手机号校验（中国大陆）
 * 验证手机号码格式是否正确
 * @param phone - 手机号码
 * @returns 是否有效，true表示有效，false表示无效
 * @example
 * isValidPhone("13800138000"); // 返回 true
 * isValidPhone("12345"); // 返回 false
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 密码强度校验
 * 根据密码的长度、字符类型等特征评估密码强度
 * @param password - 密码
 * @returns 密码强度等级：weak（弱）、medium（中）、strong（强）
 * @example
 * getPasswordStrength("123"); // 返回 'weak'
 * getPasswordStrength("password123"); // 返回 'medium'
 * getPasswordStrength("P@ssw0rd123"); // 返回 'strong'
 */
export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  let score = 0

  // 长度检查：密码长度是安全性的重要指标
  if (password.length >= 8) score++ // 长度至少8位
  if (password.length >= 12) score++ // 长度达到12位更安全

  // 字符类型检查：混合使用不同类型的字符可以增加密码的复杂度
  if (/\d/.test(password)) score++ // 包含数字
  if (/[a-z]/.test(password)) score++ // 包含小写字母
  if (/[A-Z]/.test(password)) score++ // 包含大写字母
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++ // 包含特殊字符

  // 根据得分返回密码强度等级
  if (score <= 2) return 'weak' // 得分<=2：弱密码
  if (score <= 4) return 'medium' // 得分3-4：中等强度密码
  return 'strong' // 得分>=5：强密码
}

/**
 * 用户名校验
 * 验证用户名格式是否正确
 * @param username - 用户名
 * @returns 是否有效，true表示有效，false表示无效
 * @example
 * isValidUsername("testuser"); // 返回 true
 * isValidUsername("te"); // 返回 false（太短）
 * isValidUsername("test user"); // 返回 false（包含空格）
 */
export const isValidUsername = (username: string): boolean => {
  // 用户名长度 3-20 位，只能包含字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

/**
 * 验证码校验
 * 验证验证码格式是否正确
 * @param code - 验证码
 * @param length - 验证码长度，默认为6位
 * @returns 是否有效，true表示有效，false表示无效
 * @example
 * isValidVerificationCode("123456"); // 返回 true
 * isValidVerificationCode("12345"); // 返回 false（长度不对）
 * isValidVerificationCode("abc123"); // 返回 false（包含字母）
 */
export const isValidVerificationCode = (code: string, length: number = 6): boolean => {
  const codeRegex = new RegExp(`^\d{${length}}$`)
  return codeRegex.test(code)
}

/**
 * 表单校验结果接口
 * 定义表单校验的返回结果格式
 */
export interface ValidationResult {
  isValid: boolean // 表单是否通过校验
  errors: string[] // 错误信息列表
}

/**
 * 校验表单数据
 * 根据提供的校验规则对表单数据进行验证
 * @param data - 表单数据对象
 * @param rules - 校验规则对象，键为字段名，值为校验函数
 * @returns 校验结果，包含是否通过校验和错误信息列表
 * @example
 * const data = { username: "test", email: "invalid" };
 * const rules = {
 *   username: (value) => value.length >= 3 ? null : "用户名至少3个字符",
 *   email: (value) => isValidEmail(value) ? null : "邮箱格式不正确"
 * };
 * const result = validateForm(data, rules);
 * // 返回 { isValid: false, errors: ["邮箱格式不正确"] }
 */
export const validateForm = <T extends Record<string, unknown>>(
  data: T,
  rules: Record<keyof T, (value: unknown) => string | null>
): ValidationResult => {
  const errors: string[] = []

  for (const [key, rule] of Object.entries(rules) as [
    keyof T,
    (value: unknown) => string | null,
  ][]) {
    const error = rule(data[key])
    if (error) {
      errors.push(error)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
