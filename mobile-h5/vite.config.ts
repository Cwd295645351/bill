import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(rootDir, 'src')

export default defineConfig({
  plugins: [vue()],
  base: '/mobile/',
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4100,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
