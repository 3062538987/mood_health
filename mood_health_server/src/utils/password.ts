import bcrypt from "bcryptjs";

/**
 * 密码工具函数模块
 * 提供密码加密、比对、生成和强度检测功能
 */

/**
 * 加密密码
 * 使用 bcrypt 算法对明文密码进行加密
 * @param password - 明文密码
 * @param saltRounds - 加密强度，默认10，数值越大加密越安全但计算时间越长
 * @returns 加密后的密码
 * @throws {Error} 密码加密失败时抛出错误
 * @example
 * const hashedPassword = await hashPassword("password123", 10);
 */
export const hashPassword = async (
  password: string,
  saltRounds: number = 10,
): Promise<string> => {
  try {
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("密码加密失败:", error);
    throw new Error("密码加密失败");
  }
};

/**
 * 比对密码
 * 使用 bcrypt 算法比对明文密码和加密后的密码
 * @param password - 明文密码
 * @param hashedPassword - 加密后的密码
 * @returns 密码是否匹配，true表示匹配，false表示不匹配
 * @example
 * const isValid = await comparePassword("password123", "$2a$10$...");
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error("密码比对失败:", error);
    return false;
  }
};

/**
 * 生成随机密码
 * 生成包含大小写字母、数字和特殊字符的随机密码
 * @param length - 密码长度，默认12
 * @returns 随机生成的密码
 * @example
 * const password = generateRandomPassword(16);
 */
export const generateRandomPassword = (length: number = 12): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * 验证密码强度
 * 根据密码的长度、字符类型等特征评估密码强度
 * @param password - 密码
 * @returns 密码强度等级：weak（弱）、medium（中）、strong（强）
 * @example
 * const strength = getPasswordStrength("P@ssw0rd123"); // 返回 'strong'
 */
export const getPasswordStrength = (
  password: string,
): "weak" | "medium" | "strong" => {
  let score = 0;

  // 长度检查：密码长度是安全性的重要指标
  if (password.length >= 8) score++; // 长度至少8位
  if (password.length >= 12) score++; // 长度达到12位更安全

  // 字符类型检查：混合使用不同类型的字符可以增加密码的复杂度
  if (/\d/.test(password)) score++; // 包含数字
  if (/[a-z]/.test(password)) score++; // 包含小写字母
  if (/[A-Z]/.test(password)) score++; // 包含大写字母
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++; // 包含特殊字符

  // 根据得分返回密码强度等级
  if (score <= 2) return "weak"; // 得分<=2：弱密码
  if (score <= 4) return "medium"; // 得分3-4：中等强度密码
  return "strong"; // 得分>=5：强密码
};
