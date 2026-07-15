export interface FrontendFeatureFlags {
  nonCoreModules: boolean
}

interface FeatureFlagEnvironment {
  [key: string]: unknown
}

export const getFeatureFlags = (_environment: FeatureFlagEnvironment): FrontendFeatureFlags => ({
  nonCoreModules: false,
})

export const featureFlags = getFeatureFlags(import.meta.env)
