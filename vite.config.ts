import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

// 解决 __dirname 在 ESModule 中的兼容问题
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vendorChunkGroups = [
  {
    name: 'vendor-vue',
    packages: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
  },
  {
    name: 'vendor-element-plus',
    packages: ['element-plus', '@element-plus'],
  },
  {
    name: 'vendor-echarts',
    packages: ['echarts', 'zrender', 'echarts-wordcloud'],
  },
  {
    name: 'vendor-network',
    packages: ['axios'],
  },
]

const getManualChunk = (id: string) => {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const matchedGroup = vendorChunkGroups.find(({ packages }) =>
    packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))
  )

  if (matchedGroup) {
    return matchedGroup.name
  }

  return 'vendor-misc'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devAllowedHosts = mode === 'development' ? ['localhost', 'moodhealth.loca.lt'] : undefined

  return {
    plugins: [vue()],
    base: env.VITE_BASE_URL || '/',
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getManualChunk,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      strictPort: true,
      open: true,
      allowedHosts: devAllowedHosts,
      proxy: {
        '/api/auth': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/moods': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/activities': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/posts': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/questionnaires': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/music': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api/courses': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/ai': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, '/api'),
        },
      },
    },
    preview: {
      port: 4173,
    },
  }
})
