/**
 * 功能开关配置
 * 与前端 src/config/featureFlags.ts 使用同一环境合同
 *
 * 环境变量:
 * - FEATURE_NON_CORE_MODULES: 启用非核心模块 (音乐/放松/活动/社区/课程/成就)
 *   默认: 1 (启用)
 */

export interface FeatureFlags {
  nonCoreModules: boolean
}

const toBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue
  const lower = value.toLowerCase()
  return lower === '1' || lower === 'true' || lower === 'yes'
}

export const getFeatureFlags = (): FeatureFlags => ({
  nonCoreModules: toBool(process.env.FEATURE_NON_CORE_MODULES, true),
})

export const featureFlags = getFeatureFlags()