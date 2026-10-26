import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      // 构建期需要读取 packages/node/project.jsonc 作为默认配置。
      allow: [resolve(import.meta.dirname, '../..')],
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    // Naive UI 全量组件会让 main chunk 超过默认 500 kB；本地自测工具不追求拆包。
    chunkSizeWarningLimit: 800,
  },
});
