import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = Number(process.env.E2E_BACKEND_PORT || 3100)
  const devAllowedHosts =
    mode === 'development' ? ['localhost', '127.0.0.1', 'moodhealth.loca.lt'] : undefined

  return {
    plugins: [vue()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    base: env.VITE_BASE_URL || '/',
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
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
      },
    },
    preview: {
      port: Number(process.env.E2E_FRONTEND_PORT || 3101),
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
