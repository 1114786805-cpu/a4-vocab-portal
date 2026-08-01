import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/a4-vocab-portal/',
  build: { outDir: 'docs' },
  // ★ 纯前端部署（Vercel / GitHub Pages 通用）
  // server: { ... }
})
