import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Components(),
    AutoImport({
      imports: ['vue']
    })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
