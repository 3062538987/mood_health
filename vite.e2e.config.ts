import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

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
    packages.some((pkg) => id.includes(`/node_modules/${pkg}/`)),
  )

  if (matchedGroup) {
    return matchedGroup.name
  }

  return 'vendor-misc'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = Number(process.env.E2E_BACKEND_PORT || 3100)
  const devAllowedHosts = mode === 'development' ? ['localhost', '127.0.0.1', 'moodhealth.loca.lt'] : undefined

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
      port: Number(process.env.E2E_FRONTEND_PORT || 3101),
      strictPort: true,
      open: false,
      allowedHosts: devAllowedHosts,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
        '/ai': {
          target: 'http://127.0.0.1:8000',
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
