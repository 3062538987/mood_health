/**
 * 表单校验工具函数
 */

/**
 * 邮箱校验
 * @param email 邮箱地址
 * @returns 是否有效
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 手机号校验（中国大陆）
 * @param phone 手机号码
 * @returns 是否有效
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * 密码强度校验
 * @param password 密码
 * @returns 密码强度等级：weak, medium, strong
 */
export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  let score = 0;
  
  // 长度检查
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  // 包含数字
  if (/\d/.test(password)) score++;
  
  // 包含小写字母
  if (/[a-z]/.test(password)) score++;
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) score++;
  
  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
};

/**
 * 用户名校验
 * @param username 用户名
 * @returns 是否有效
 */
export const isValidUsername = (username: string): boolean => {
  // 用户名长度 3-20 位，只能包含字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * 验证码校验
 * @param code 验证码
 * @param length 验证码长度
 * @returns 是否有效
 */
export const isValidVerificationCode = (code: string, length: number = 6): boolean => {
  const codeRegex = new RegExp(`^\d{${length}}$`);
  return codeRegex.test(code);
};

/**
 * 表单校验结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * 校验表单数据
 * @param data 表单数据
 * @param rules 校验规则
 * @returns 校验结果
 */
export const validateForm = <T extends Record<string, unknown>>(
  data: T,
  rules: Record<keyof T, (value: unknown) => string | null>
): ValidationResult => {
  const errors: string[] = [];
  
  for (const [key, rule] of Object.entries(rules) as [keyof T, (value: unknown) => string | null][]) {
    const error = rule(data[key]);
    if (error) {
      errors.push(error);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
