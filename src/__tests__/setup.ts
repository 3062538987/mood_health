// Polyfill localStorage for Node.js 26+ where it is no longer a default global.
// Vitest happy-dom environment should provide this, but the Node.js 26 global
// absence can interfere with happy-dom's initialization.
const store = new Map<string, string>()

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
  get length() {
    return store.size
  },
  key: (index: number) => {
    const keys = Array.from(store.keys())
    return keys[index] ?? null
  },
} as Storage