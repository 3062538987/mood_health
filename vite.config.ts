import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";

// 解决 __dirname 在 ESModule 中的兼容问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === "production" ? "/app/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
    open: true,
    allowedHosts: ["localhost", "moodhealth.loca.lt"],
    proxy: {
      "/api/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/moods": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/activities": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/posts": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/questionnaires": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/music": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/courses": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/ai": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, "/api"),
      },
    },
  },
  preview: {
    port: 4173,
    allowedHosts: [
      "localhost",
      "moodhealth-prod.loca.lt",
      "happy-otters-shave.loca.lt",
      "warm-falcons-know.loca.lt",
      "wicked-toes-walk.loca.lt",
      "moodhealth-stable.loca.lt",
    ],
  },
});
