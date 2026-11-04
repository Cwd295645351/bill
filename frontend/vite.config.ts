import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const pathResolve = (dir: string) => path.resolve(__dirname, dir)

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  define: {
    __VUE_OPTIONS_API__: false,
  },
  esbuild: {
    // drop: ['console', 'debugger'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': pathResolve('./src'),
    },
  },
  css: {
    // postcss: pathResolve('./postcss.config.js'),
  },
  // History 模式：生产挂在 /pc/；本地 dev 用根路径，便于 http://localhost:4000/
  base: command === 'build' ? '/pc/' : '/',
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true,
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}))
