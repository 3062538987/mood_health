const trimTrailingSlash = (value?: string) => (value || '').replace(/\/+$/, '')

const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`)

const joinBaseAndPath = (
  baseValue: string | undefined,
  path: string,
  duplicatePrefixes: string[]
) => {
  const base = trimTrailingSlash(baseValue)
  const normalizedPath = ensureLeadingSlash(path)

  if (!base) {
    return normalizedPath
  }

  const matchedPrefix = duplicatePrefixes.find(
    (prefix) =>
      base.endsWith(prefix) &&
      (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
  )

  if (matchedPrefix) {
    const strippedPath = normalizedPath.slice(matchedPrefix.length)
    return strippedPath ? `${base}${strippedPath}` : base
  }

  return `${base}${normalizedPath}`
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export const getApiBaseUrl = () => {
  const configuredBase = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL)
  if (!configuredBase || typeof window === 'undefined') {
    return configuredBase
  }

  try {
    const configuredUrl = new URL(configuredBase)
    if (
      LOOPBACK_HOSTS.has(configuredUrl.hostname) &&
      configuredUrl.hostname !== window.location.hostname
    ) {
      return ''
    }
  } catch {
    // Relative API bases are already same-origin safe.
  }

  return configuredBase
}

export const buildApiUrl = (path: string) =>
  joinBaseAndPath(import.meta.env.VITE_API_BASE_URL, path, ['/api'])
