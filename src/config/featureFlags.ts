export interface FrontendFeatureFlags {
  nonCoreModules: boolean
}

interface FeatureFlagEnvironment {
  [key: string]: unknown
}

const toBool = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) return defaultValue
  const str = String(value).toLowerCase()
  return str === '1' || str === 'true'
}

/**
 * 获取功能开关
 * 与后端 mood_health_server/src/config/featureFlags.ts 使用同一环境合同
 *
 * 环境变量:
 * - VITE_FEATURE_NON_CORE_MODULES: 启用非核心模块 (音乐/放松/活动/社区/课程/成就)
 *   默认: 1 (启用)
 */
export const getFeatureFlags = (_environment: FeatureFlagEnvironment): FrontendFeatureFlags => ({
  nonCoreModules: toBool(import.meta.env.VITE_FEATURE_NON_CORE_MODULES, true),
})

export const featureFlags = getFeatureFlags(import.meta.env)
