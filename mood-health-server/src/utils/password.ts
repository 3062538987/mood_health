import bcrypt from "bcryptjs";

/**
 * 密码工具函数
 */

/**
 * 加密密码
 * @param password 明文密码
 * @param saltRounds 加密强度，默认10
 * @returns 加密后的密码
 */
export const hashPassword = async (password: string, saltRounds: number = 10): Promise<string> => {
  try {
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("密码加密失败:", error);
    throw new Error("密码加密失败");
  }
};

/**
 * 比对密码
 * @param password 明文密码
 * @param hashedPassword 加密后的密码
 * @returns 密码是否匹配
 */
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error("密码比对失败:", error);
    return false;
  }
};

/**
 * 生成随机密码
 * @param length 密码长度，默认12
 * @returns 随机生成的密码
 */
export const generateRandomPassword = (length: number = 12): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * 验证密码强度
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
