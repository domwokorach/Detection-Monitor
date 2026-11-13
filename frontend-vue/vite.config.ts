import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Served under /vue on Vercel (see vercel.json); at the root everywhere else.
  base: process.env.VERCEL ? '/vue/' : '/',
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': process.env.API_URL ?? 'http://localhost:8000' } },
  build: { chunkSizeWarningLimit: 900 },
})
