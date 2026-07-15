export interface FrontendFeatureFlags {
  nonCoreModules: boolean
}

interface FeatureFlagEnvironment {
  [key: string]: unknown
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])

export const getFeatureFlags = (environment: FeatureFlagEnvironment): FrontendFeatureFlags => {
  const rawValue = environment.VITE_FEATURE_NON_CORE_MODULES_ENABLED
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : ''

  return { nonCoreModules: TRUE_VALUES.has(normalizedValue) }
}

export const featureFlags = getFeatureFlags(import.meta.env)
