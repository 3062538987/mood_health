const trimTrailingSlash = (value?: string) => (value || '').replace(/\/+$/, '')

const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`)

const normalizeAiPath = (path: string) => {
  const normalizedPath = ensureLeadingSlash(path)

  if (normalizedPath === '/api/ai' || normalizedPath === '/api') {
    return '/'
  }

  if (normalizedPath.startsWith('/api/ai/')) {
    return normalizedPath.slice('/api/ai'.length)
  }

  if (normalizedPath.startsWith('/api/')) {
    return normalizedPath.slice('/api'.length)
  }

  return normalizedPath
}

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

export const getApiBaseUrl = () => trimTrailingSlash(import.meta.env.VITE_API_BASE_URL)

export const getAiBaseUrl = () => trimTrailingSlash(import.meta.env.VITE_AI_API_URL || '/ai')

export const buildApiUrl = (path: string) =>
  joinBaseAndPath(import.meta.env.VITE_API_BASE_URL, path, ['/api'])

export const buildAiApiUrl = (path: string) =>
  joinBaseAndPath(getAiBaseUrl(), normalizeAiPath(path), ['/api/ai', '/api', '/ai'])
