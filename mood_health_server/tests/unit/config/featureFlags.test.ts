import { getFeatureFlags } from '../../../src/config/featureFlags'

describe('backend feature flags', () => {
  it('keeps non-core modules disabled by default', () => {
    expect(getFeatureFlags({})).toEqual({ nonCoreModules: false })
  })

  it.each(['true', '1', 'yes', 'on', ' TRUE '])('enables non-core modules for %s', (value) => {
    expect(getFeatureFlags({ FEATURE_NON_CORE_MODULES_ENABLED: value }).nonCoreModules).toBe(true)
  })

  it('uses the safe disabled value for unsupported input', () => {
    expect(getFeatureFlags({ FEATURE_NON_CORE_MODULES_ENABLED: 'enabled' }).nonCoreModules).toBe(false)
  })
})
