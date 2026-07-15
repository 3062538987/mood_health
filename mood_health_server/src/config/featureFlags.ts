interface FeatureFlagEnvironment {
  FEATURE_NON_CORE_MODULES_ENABLED?: string
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])

const isEnabled = (value: string | undefined): boolean =>
  value === undefined ? false : TRUE_VALUES.has(value.trim().toLowerCase())

export const getFeatureFlags = (environment: FeatureFlagEnvironment = process.env) => ({
  nonCoreModules: isEnabled(environment.FEATURE_NON_CORE_MODULES_ENABLED),
})
